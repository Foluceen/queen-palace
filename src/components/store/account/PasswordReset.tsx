"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { TextField } from "@/components/ui/Field";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import { isMockMode } from "@/lib/api/config";

/** Step 1: request a reset link. The reply is the same whether or not the email has an account. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  if (state === "sent") {
    return (
      <div className="stack auth-form" role="status">
        <p>If an account uses {email}, we've sent a link to reset the password. It works for one hour.</p>
        {isMockMode ? <p className="notice notice--info small">Demo mode sends no email. The reset link is printed in the server log.</p> : null}
        <Link href="/account" className="btn btn--ghost">
          Back to sign in
        </Link>
      </div>
    );
  }
  return (
    <form
      className="stack auth-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        setError(null);
        try {
          await api().call("customerRequestPasswordReset", { body: { email } });
          setState("sent");
        } catch (err) {
          setError(errorMessage(err));
          setState("idle");
        }
      }}
    >
      <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={state === "sending"}>
        {state === "sending" ? <span className="spinner" aria-hidden /> : null}
        Send reset link
      </button>
      <Link href="/account" className="small">
        Back to sign in
      </Link>
    </form>
  );
}

/** Step 2: choose a new password using the token from the emailed link. */
export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  if (!token) {
    return (
      <div className="stack auth-form">
        <p className="notice notice--warning">This link is missing its reset code. Request a new link.</p>
        <Link href="/account/forgot" className="btn">
          Request a new link
        </Link>
      </div>
    );
  }
  if (state === "done") {
    return (
      <div className="stack auth-form" role="status">
        <p>Your password has been changed. You can sign in with it now.</p>
        <Link href="/account" className="btn">
          Sign in
        </Link>
      </div>
    );
  }
  return (
    <form
      className="stack auth-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (password !== confirm) {
          setError("The two passwords don't match.");
          return;
        }
        setState("saving");
        setError(null);
        try {
          await api().call("customerResetPassword", { body: { token, password } });
          setState("done");
        } catch (err) {
          setError(errorMessage(err));
          setState("idle");
        }
      }}
    >
      <TextField label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" hint="At least 8 characters." />
      <TextField label="Confirm new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
      {error ? (
        <p className="field__error" role="alert">
          {error} {/expired/i.test(error) ? <Link href="/account/forgot">Request a new link.</Link> : null}
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={state === "saving"}>
        {state === "saving" ? <span className="spinner" aria-hidden /> : null}
        Change password
      </button>
    </form>
  );
}
