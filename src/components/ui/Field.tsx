"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
  className?: string;
}

export function FieldShell({ label, hint, error, children, className }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`field ${className ?? ""}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {hint ? (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="field__error" id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

type Common = { label: string; hint?: ReactNode; error?: string; wrapperClassName?: string };

export function TextField({ label, hint, error, wrapperClassName, ...props }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => <input id={id} className="input" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...props} />}
    </FieldShell>
  );
}

export function SelectField({ label, hint, error, wrapperClassName, children, ...props }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <select id={id} className="select" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...props}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}

export function TextAreaField({ label, hint, error, wrapperClassName, ...props }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => <textarea id={id} className="textarea" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...props} />}
    </FieldShell>
  );
}
