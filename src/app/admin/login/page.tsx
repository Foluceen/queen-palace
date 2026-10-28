"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { TextField } from "@/components/ui/Field";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import { isMockMode } from "@/lib/api/config";

const demoAccounts = [
  { email: "owner@queenpalace.test", password: "demo-owner", role: "Owner, full access" },
  { email: "manager@queenpalace.test", password: "demo-manager", role: "Store manager" },
  { email: "fulfilment@queenpalace.test", password: "demo-fulfilment", role: "Fulfilment" },
];

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
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
          try {
            await api().call("adminLogin", { body: { email, password } });
            router.replace(next && next.startsWith("/admin") ? next : "/admin");
          } catch (err) {
            setError(errorMessage(err));
            setBusy(false);
          }
        }}
      >
        <span className="alogin__logo">
          <Logo variant="stacked" title="Queen Palace Beauty World" />
        </span>
        <h1 className="h3" style={{ textAlign: "center" }}>
          Store admin
        </h1>
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
