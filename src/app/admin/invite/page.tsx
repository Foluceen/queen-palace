"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { TextField } from "@/components/ui/Field";
import { api } from "@/lib/api/browser";
import { ApiError, errorMessage } from "@/lib/api/client";

/**
 * A new staff member sets their password from the one-time invite link
 * (/admin/invite#token=…). The token stays in the URL fragment, which browsers never send to
 * servers; it is removed from the address bar as soon as the page has read it.
 */
export default function AcceptInvitePage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    setToken(t);
    if (t) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <div className="alogin">
      <form
        className="alogin__card"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (password.length < 10) return setError("Use at least 10 characters.");
          if (password !== confirm) return setError("The two passwords don't match.");
          setBusy(true);
          try {
            const res = await api().call("acceptStaffInvite", { body: { token: token ?? "", password } }, { skipValidation: true });
            setDone(res.email ?? "");
          } catch (err) {
            setError(err instanceof ApiError && (err.code === "invalid_invitation" || err.status === 400) ? "This invite link is invalid, already used or expired. Ask the store owner for a new one." : errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="alogin__logo">
          <Logo variant="stacked" title="Queen Luxury Hair" />
        </span>
        <h1 className="h3" style={{ textAlign: "center" }}>
          {done !== null ? "You're all set" : "Set your admin password"}
        </h1>
        {done !== null ? (
          <>
            <p style={{ textAlign: "center" }}>Your password is saved. Sign in{done ? ` with ${done}` : ""} and your new password.</p>
            <Link href="/admin/login" className="btn btn--block">
              Go to sign in
            </Link>
          </>
        ) : token === "" ? (
          <p className="notice notice--danger" role="alert">
            This page needs the full invite link. Open the link exactly as it was sent to you, or ask the store owner for a new one.
          </p>
        ) : (
          <>
            <p className="small muted">Choose a password only you know. Use at least 10 characters.</p>
            <TextField label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" autoFocus />
            <TextField label="Type it again" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
            {error ? (
              <p className="notice notice--danger" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="btn btn--block" disabled={busy || token === null}>
              {busy ? <span className="spinner" aria-hidden /> : null}
              Save password
            </button>
          </>
        )}
      </form>
    </div>
  );
}
