"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: { label: string; href?: string; onClick?: () => void } }) {
  return (
    <div className="state" role="status">
      <h2 className="state__title">{title}</h2>
      {body ? <p className="muted">{body}</p> : null}
      {action ? (
        action.href ? (
          <Link className="btn" href={action.href}>
            {action.label}
          </Link>
        ) : (
          <button type="button" className="btn" onClick={action.onClick}>
            {action.label}
          </button>
        )
      ) : null}
    </div>
  );
}

export function ErrorState({ title = "This didn't load", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div className="state" role="alert">
      <h2 className="state__title">{title}</h2>
      <p className="muted">{message}</p>
      {onRetry ? (
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span className="spinner" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
    </span>
  );
}
