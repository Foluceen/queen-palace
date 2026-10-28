"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/browser";
import { ApiError, errorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import type { Review, ReviewStatus } from "@/lib/types";

const STATUS: Record<ReviewStatus, { label: string; tone: string; note: string }> = {
  pending: { label: "Waiting for approval", tone: "badge--warning", note: "Our team checks every review before it appears, usually within a day." },
  approved: { label: "Published", tone: "badge--success", note: "Visible on the product page." },
  rejected: { label: "Not published", tone: "badge--neutral", note: "This review isn't shown on the store." },
};

/** The signed-in customer's reviews in every state, exactly as the backend reports them. */
export function MyReviews() {
  const [list, setList] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setList(await api().call("listCustomerReviews"));
    } catch (err) {
      if (err instanceof ApiError && (err.isUnavailable || err.status === 404)) setUnavailable(true);
      else setError(errorMessage(err));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section id="reviews" aria-labelledby="acct-reviews" className="acct-reviews">
      <h2 id="acct-reviews" className="h3">
        My reviews
      </h2>
      {unavailable ? (
        <p className="muted">Your review history isn't available yet.</p>
      ) : error ? (
        <div className="cluster">
          <p className="field__error" role="alert">
            {error}
          </p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : !list ? (
        <div className="skeleton" style={{ height: 100 }} />
      ) : list.length === 0 ? (
        <p className="muted">You haven't written any reviews yet. You can review a product from its page.</p>
      ) : (
        <ul className="acct-reviews__list">
          {list.map((r) => {
            const s = STATUS[r.status];
            return (
              <li key={r.id} className="acct-review">
                <div className="acct-review__head">
                  {r.productHandle ? <Link href={`/products/${r.productHandle}`}>{r.productTitle}</Link> : <strong>{r.productTitle}</strong>}
                  <span className={`badge ${s?.tone ?? ""}`}>{s?.label ?? r.status}</span>
                </div>
                <p className="small">
                  <span className="acct-review__stars" aria-label={`${r.rating} out of 5 stars`}>{"★".repeat(r.rating)}</span>
                  <span className="muted" aria-hidden>
                    {"★".repeat(5 - r.rating)}
                  </span>{" "}
                  {r.title ? <strong>{r.title}</strong> : null}
                </p>
                <p className="small muted acct-review__body">{r.body}</p>
                <p className="small muted">
                  Submitted {formatDate(r.createdAt)}. {s?.note}
                </p>
                {r.status === "rejected" && r.rejectionReason ? (
                  <p className="small acct-review__reason">
                    <strong>Reason:</strong> {r.rejectionReason}
                  </p>
                ) : null}
                {r.status === "approved" && r.reply ? (
                  <p className="small acct-review__reason">
                    <strong>Reply from Queen Luxury Hair:</strong> {r.reply}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
