"use client";

import { useState } from "react";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { api } from "@/lib/api/browser";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { InquiryInput } from "@/lib/types";

const empty: InquiryInput = { name: "", email: "", phone: "", topic: "product", orderNumber: "", message: "" };

export function ContactForm() {
  const [form, setForm] = useState<InquiryInput>(empty);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const set = (k: keyof InquiryInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (state === "sent") {
    return (
      <div className="notice notice--success" role="status">
        Message sent. We'll reply to {form.email} soon.
        <button
          type="button"
          className="link-btn small"
          onClick={() => {
            setForm(empty);
            setState("idle");
          }}
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form
      className="stack contact__form"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        setFields({});
        setError(null);
        try {
          await api().call("createInquiry", { body: form });
          setState("sent");
        } catch (err) {
          setState("idle");
          if (err instanceof ApiError && err.fields) setFields(err.fields);
          setError(errorMessage(err));
        }
      }}
    >
      <div className="form-grid">
        <TextField label="Name" value={form.name} onChange={set("name")} error={fields.name} required autoComplete="name" />
        <TextField label="Email" type="email" value={form.email} onChange={set("email")} error={fields.email} required autoComplete="email" />
        <TextField label="Phone (optional)" type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" />
        <SelectField label="What's it about?" value={form.topic} onChange={set("topic")}>
          <option value="product">A product or texture</option>
          <option value="order">An order</option>
          <option value="wholesale">Wholesale or salon orders</option>
          <option value="other">Something else</option>
        </SelectField>
        {form.topic === "order" ? <TextField label="Order number" value={form.orderNumber} onChange={set("orderNumber")} placeholder="QLH-10412" wrapperClassName="span-2" /> : null}
      </div>
      <TextAreaField label="Message" value={form.message} onChange={set("message")} error={fields.message} required rows={6} />
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={state === "sending"}>
        {state === "sending" ? <span className="spinner" aria-hidden /> : null}
        Send message
      </button>
    </form>
  );
}
