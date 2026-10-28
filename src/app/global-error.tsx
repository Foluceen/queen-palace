"use client";

import "./globals.css";

/** Last-resort boundary if the root layout fails. Plain markup, no data. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-NG">
      <body>
        <main className="unavailable" role="alert">
          <h1 className="h2">Queen Palace Beauty World is temporarily unavailable</h1>
          <p className="muted">Please try again in a few minutes.</p>
          <button type="button" className="btn" onClick={reset}>
            Try again
          </button>
          {error.digest ? <p className="small muted">Reference: {error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
