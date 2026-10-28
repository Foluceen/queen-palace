"use client";

import { useState } from "react";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import { ApiError, errorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import type { Paginated, Review } from "@/lib/types";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" role="img" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={14} className={i <= rating ? "is-on" : ""} />
      ))}
    </span>
  );
}

export function Reviews({ productId, initial, average }: { productId: string; initial: Paginated<Review>; average: number }) {
  const [data, setData] = useState(initial);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const more = async () => {
    setLoadingMore(true);
    setLoadError(null);
    try {
      const next = await api().call("listProductReviews", { params: { productId }, query: { page: data.page + 1 } });
      setData((d) => ({ ...next, items: [...d.items, ...next.items] }));
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section id="reviews" className="reviews" aria-labelledby="reviews-title">
      <header className="reviews__head">
        <div>
          <h2 id="reviews-title" className="h2">
            Reviews
          </h2>
          {data.total ? (
            <p className="muted">
              {average.toFixed(1)} average from {data.total} published {data.total === 1 ? "review" : "reviews"}
            </p>
          ) : (
            <p className="muted">No reviews yet. Bought this? Tell other customers how it wears.</p>
          )}
        </div>
        <button type="button" className="btn btn--ghost" aria-expanded={formOpen} onClick={() => setFormOpen((o) => !o)}>
          Write a review
        </button>
      </header>

      {formOpen ? <ReviewForm productId={productId} onDone={() => setFormOpen(false)} /> : null}

      <ul className="reviews__list">
        {data.items.map((r) => (
          <li key={r.id} className="review">
            <div className="review__meta">
              <Stars rating={r.rating} />
              <span className="review__author">{r.author}</span>
              {r.location ? <span className="muted small">{r.location}</span> : null}
              {r.verifiedPurchase ? <span className="badge badge--success">Verified buyer</span> : null}
            </div>
            <h3 className="review__title">{r.title}</h3>
            <p>{r.body}</p>
            {r.reply ? <p className="review__reply small">Reply from the store: {r.reply}</p> : null}
            <p className="small muted">{formatDate(r.createdAt)}</p>
          </li>
        ))}
      </ul>
      {loadError ? (
        <p className="field__error" role="alert">
          {loadError}
        </p>
      ) : null}
      {data.page < data.totalPages ? (
        <button type="button" className="btn btn--ghost" onClick={more} disabled={loadingMore}>
          {loadingMore ? <span className="spinner" aria-hidden /> : null}
          {loadError ? "Try again" : "Show more reviews"}
        </button>
      ) : null}
    </section>
  );
}

function ReviewForm({ productId, onDone }: { productId: string; onDone(): void }) {
  const [form, setForm] = useState({ author: "", email: "", location: "", rating: 5, title: "", body: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [formError, setFormError] = useState<string | null>(null);

  if (state === "sent") {
    return (
      <div className="notice notice--success" role="status">
        Thanks. Your review is with our team and will appear once it's checked, usually within a day.
        <button type="button" className="link-btn small" onClick={onDone}>
          Close
        </button>
      </div>
    );
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form
      className="review-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        setErrors({});
        setFormError(null);
        try {
          await api().call("createProductReview", { params: { productId }, body: { ...form, rating: Number(form.rating) } });
          setState("sent");
        } catch (err) {
          setState("idle");
          if (err instanceof ApiError && err.fields) setErrors(err.fields);
          setFormError(errorMessage(err));
        }
      }}
    >
      <fieldset className="rating-input">
        <legend className="field__label">Your rating</legend>
        <div className="cluster">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={`rating-input__star ${n <= form.rating ? "is-on" : ""}`}>
              <input type="radio" name="rating" value={n} checked={form.rating === n} onChange={() => setForm((f) => ({ ...f, rating: n }))} className="sr-only" />
              <Icon name="star" size={24} />
              <span className="sr-only">{n} star{n > 1 ? "s" : ""}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="form-grid">
        <TextField label="Name shown on review" value={form.author} onChange={set("author")} error={errors.author} required autoComplete="name" />
        <TextField label="Email (not shown)" type="email" value={form.email} onChange={set("email")} error={errors.email} required autoComplete="email" />
        <TextField label="City (optional)" value={form.location} onChange={set("location")} />
        <TextField label="Title" value={form.title} onChange={set("title")} />
      </div>
      <TextAreaField label="Your review" value={form.body} onChange={set("body")} error={errors.body} required hint="How did it install, wash and hold up?" />
      {formError ? (
        <p className="field__error" role="alert">
          {formError}
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={state === "sending"}>
        {state === "sending" ? <span className="spinner" aria-hidden /> : null}
        Submit review
      </button>
    </form>
  );
}
