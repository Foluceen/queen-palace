"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/Field";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import type { Order } from "@/lib/types";
import { OrderView } from "./OrderView";

export function TrackOrder() {
  const [number, setNumber] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="track">
      <form
        className="track__form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            setOrder(await api().call("trackOrder", { body: { number, email } }));
          } catch (err) {
            setOrder(null);
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <TextField label="Order number" value={number} onChange={(e) => setNumber(e.target.value)} required placeholder="IR-10412" autoCapitalize="characters" />
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          Find my order
        </button>
      </form>
      {error ? (
        <p className="notice notice--danger" role="alert">
          {error}
        </p>
      ) : null}
      {order ? (
        <section aria-label={`Order ${order.number}`} className="track__result">
          <h2 className="h2">Order {order.number}</h2>
          <OrderView order={order} />
        </section>
      ) : null}
    </div>
  );
}
