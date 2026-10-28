"use client";

import { useState } from "react";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  if (state === "done") {
    return (
      <p className="newsletter__done" role="status">
        You're on the list. We email when new textures land, about twice a month.
      </p>
    );
  }

  return (
    <form
      className="newsletter"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        try {
          await api().call("subscribeNewsletter", { body: { email } });
          setState("done");
        } catch (err) {
          setError(errorMessage(err));
          setState("error");
        }
      }}
    >
      <label htmlFor="newsletter-email" className="newsletter__label">
        Hear about new textures first
      </label>
      <div className="newsletter__row">
        <input id="newsletter-email" type="email" required className="input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={state === "error" || undefined} aria-describedby={state === "error" ? "newsletter-error" : undefined} />
        <button type="submit" className="btn" disabled={state === "sending"}>
          {state === "sending" ? <span className="spinner" aria-hidden /> : null}
          Subscribe
        </button>
      </div>
      {state === "error" ? (
        <p id="newsletter-error" className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
