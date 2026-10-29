"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { normalizeEmail } from "@/lib/email";
import { Suspense, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { TextField } from "@/components/ui/Field";
import { api } from "@/lib/api/browser";
import { ApiError, errorMessage } from "@/lib/api/client";
import { isMockMode } from "@/lib/api/config";
import { safeNext } from "@/lib/redirect";

const demoAccounts = [
  { email: "owner@queenluxuryhair.test", password: "demo-owner", role: "Owner, full access" },
  { email: "manager@queenluxuryhair.test", password: "demo-manager", role: "Store manager" },
  { email: "fulfilment@queenluxuryhair.test", password: "demo-fulfilment", role: "Fulfilment" },
];

/**
 * Signs in, then confirms the session works before entering the admin.
 * The backend decides whether the credentials are right (any 2xx means yes); the session
 * cookie it sets is what authorises every later request, so that is what gets checked.
 * Returns an error message, or null on success.
 */
async function signIn(email: string, password: string): Promise<string | null> {
  try {
    await api().call("adminLogin", { body: { email, password } }, { skipValidation: true });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401 || err.status === 400 || err.status === 422) return err.message || "That email and password don't match a staff account.";
      if (err.status === 429) return "Too many sign-in attempts. Wait a few minutes before trying again.";
      if (err.status === 403) return err.message || "This staff account can't sign in. Ask the store owner to check it.";
    }
    return errorMessage(err);
  }
  try {
    await api().call("adminSession");
    return null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return "The store accepted your password, but this browser didn't receive a session. The API needs to set its session cookie on sign-in (HttpOnly, Secure, SameSite=Lax). Please report this to the developer.";
    }
    if (err instanceof ApiError && err.code === "contract_mismatch") {
      console.error("[admin] signed in, but the session response can't be read:", err.fields?._contract, "| fields:", err.fields?._shape);
      return "The store accepted your password, but returned your staff profile in a format this admin can't read yet. Please report this to the developer.";
    }
    return errorMessage(err);
  }
}

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next");
  const expired = sp.get("expired") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="alogin">
      <ThemeToggle className="alogin__theme" />
      <form
        className="alogin__card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const msg = await signIn(normalizeEmail(email), password);
          if (msg) {
            setError(msg);
            setBusy(false);
          } else {
            router.replace(safeNext(next, "/admin", "/admin"));
          }
        }}
      >
        <span className="alogin__logo">
          <Logo variant="stacked" title="Queen Luxury Hair" />
        </span>
        <h1 className="h3" style={{ textAlign: "center" }}>
          Store admin
        </h1>
        {expired ? (
          <p className="notice notice--warning small" role="status">
            Your session ended. Sign in again to continue.
          </p>
        ) : null}
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" autoFocus />
        <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        {error ? (
          <p className="notice notice--danger" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn--block" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          Sign in
        </button>
        {isMockMode ? (
          <div className="alogin__demo">
            <p className="small">
              <strong>Demo accounts.</strong> Each role sees a different admin, so you can check permission-aware screens.
            </p>
            <ul>
              {demoAccounts.map((a) => (
                <li key={a.email}>
                  <button
                    type="button"
                    className="link-btn small"
                    onClick={() => {
                      setEmail(a.email);
                      setPassword(a.password);
                    }}
                  >
                    Use {a.role}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
