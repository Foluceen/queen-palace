"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { koboToInput, parseNairaInput } from "@/lib/format";
import type { Kobo } from "@/lib/types";

export function PageHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <header className="apage-head">
      <div>
        {back}
        <h1 className="apage-head__title">{title}</h1>
        {description ? <p className="muted">{description}</p> : null}
      </div>
      {actions ? <div className="cluster">{actions}</div> : null}
    </header>
  );
}

export function Panel({ title, children, actions, className }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`apanel ${className ?? ""}`}>
      {title || actions ? (
        <header className="apanel__head">
          {title ? <h2 className="apanel__title">{title}</h2> : <span />}
          {actions}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="aloading" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 44 }} />
      ))}
    </div>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry(): void }) {
  return (
    <div className="notice notice--danger" role="alert">
      <span>{message}</span>
      <button type="button" className="btn btn--sm btn--ghost" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="aempty">
      <p className="aempty__title">{title}</p>
      {body ? <p className="muted small">{body}</p> : null}
      {action}
    </div>
  );
}

/** Naira input that reports integer kobo. */
export function MoneyInput({ value, onChange, id, invalid, placeholder = "0", ariaLabel, disabled }: { value: Kobo | null; onChange(v: Kobo | null): void; id?: string; invalid?: boolean; placeholder?: string; ariaLabel?: string; disabled?: boolean }) {
  const [text, setText] = useState(koboToInput(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      setText(koboToInput(value));
      last.current = value;
    }
  }, [value]);
  return (
    <div className="money">
      <span className="money__symbol" aria-hidden>
        ₦
      </span>
      <input
        id={id}
        className="input money__input"
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value);
          const k = parseNairaInput(e.target.value);
          last.current = k;
          onChange(k);
        }}
      />
    </div>
  );
}

/** Accessible confirmation built on <dialog>. */
export function ConfirmButton({ label, title, body, confirmLabel, onConfirm, className = "btn btn--ghost btn--sm", danger, disabled, children }: { label: string; title: string; body?: ReactNode; confirmLabel: string; onConfirm(): Promise<void> | void; className?: string; danger?: boolean; disabled?: boolean; children?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.showModal()} disabled={disabled}>
        {label}
      </button>
      <dialog ref={ref} className="adialog adialog--sm" aria-labelledby={titleId}>
        <form method="dialog" className="adialog__body">
          <h2 id={titleId} className="adialog__title">
            {title}
          </h2>
          {body ? <div className="muted">{body}</div> : null}
          {children}
          <div className="adialog__actions">
            <button type="submit" className="btn btn--ghost" disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${danger ? "btn--danger" : ""}`}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  ref.current?.close();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <span className="spinner" aria-hidden /> : null}
              {confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

/** Side sheet for create/edit forms. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose(): void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="asheet"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="asheet__panel">
        <header className="asheet__head">
          <h2 className="apanel__title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="asheet__body">{open ? children : null}</div>
        {footer ? <footer className="asheet__foot">{footer}</footer> : null}
      </div>
    </dialog>
  );
}

export function StatusBadge({ tone, children }: { tone: "success" | "warning" | "danger" | "info" | "neutral" | "ink"; children: ReactNode }) {
  return <span className={`badge ${tone === "neutral" ? "" : `badge--${tone}`}`}>{children}</span>;
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange(v: boolean): void; label: string; disabled?: boolean }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span className="switch__track" aria-hidden>
        <span className="switch__thumb" />
      </span>
      <span>{label}</span>
    </label>
  );
}
