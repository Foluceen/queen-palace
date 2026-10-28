"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SIGNED_IN_KEY } from "@/components/store/WishlistProvider";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import { ApiError, errorMessage } from "@/lib/api/client";
import { isMockMode } from "@/lib/api/config";
import { formatDate } from "@/lib/format";
import { REVIEW_LIMITS, type ReviewInput, type ReviewPage, type ReviewSort, type ReviewSubmission, type ReviewSummary } from "@/lib/types";

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="stars" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={size} className={i <= rating ? "is-on" : ""} />
      ))}
    </span>
  );
}

const SORTS: { value: ReviewSort; label: string }[] = [
  { value: "newest", label: "Most recent" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
];

interface Props {
  productId: string;
  productTitle: string;
  /** null when the reviews request failed on the server. */
  initial: ReviewPage | null;
  /** The product's own rating fields, used when the list has no summary. */
  rating: { average: number; count: number };
}

export function Reviews({ productId, productTitle, initial, rating }: Props) {
  const [data, setData] = useState<ReviewPage | null>(initial);
  const [sort, setSort] = useState<ReviewSort>("newest");
  const [loading, setLoading] = useState<"more" | "reload" | null>(null);
  const [loadError, setLoadError] = useState<string | null>(initial ? null : "Reviews couldn't be loaded right now.");
  const [formOpen, setFormOpen] = useState(false);

  const load = async (page: number, nextSort: ReviewSort, append: boolean) => {
    setLoading(append ? "more" : "reload");
    setLoadError(null);
    try {
      const next = await api().call("listProductReviews", { params: { productId }, query: { page, sort: nextSort } });
      setData((d) => (append && d ? { ...next, items: [...d.items, ...next.items] } : next));
    } catch (err) {
      setLoadError(errorMessage(err, "Reviews couldn't be loaded right now."));
    } finally {
      setLoading(null);
    }
  };

  const summary: ReviewSummary | null = data?.summary ?? null;
  const count = summary?.count ?? data?.total ?? rating.count;
  const average = summary?.average ?? rating.average;

  return (
    <section id="reviews" className="reviews" aria-labelledby="reviews-title">
      <header className="reviews__top">
        <h2 id="reviews-title" className="section-title">
          Customer reviews
        </h2>
        {isMockMode && count ? <p className="small muted">Demo mode: these are sample reviews, not real customers.</p> : null}
      </header>

      <div className="reviews__summary">
        <div className="reviews__score">
          {count ? (
            <>
              <p className="reviews__average">{average.toFixed(1)}</p>
              <span className="stars-fill reviews__score-stars" style={{ "--rating": average } as React.CSSProperties} role="img" aria-label={`${average.toFixed(1)} out of 5 stars`} />
              <p className="small muted">
                Based on {count} {count === 1 ? "review" : "reviews"}
              </p>
            </>
          ) : (
            <>
              <p className="reviews__empty-title">No reviews yet</p>
              <p className="small muted">Bought this? Tell other customers how it installs, wears and washes.</p>
            </>
          )}
        </div>

        {summary && count ? <Distribution summary={summary} /> : <div className="reviews__bars" aria-hidden />}

        <div className="reviews__cta">
          <button type="button" className="btn btn--lg" aria-expanded={formOpen} aria-controls="review-form" onClick={() => setFormOpen((o) => !o)}>
            {formOpen ? "Cancel review" : "Write a review"}
          </button>
        </div>
      </div>

      {formOpen ? <ReviewForm productId={productId} productTitle={productTitle} onClose={() => setFormOpen(false)} onPublished={() => void load(1, sort, false)} /> : null}

      {data && data.items.length ? (
        <div className="reviews__toolbar">
          <label className="reviews__sort">
            <span className="small muted">Sort by</span>
            <select
              className="select"
              value={sort}
              onChange={(e) => {
                const next = e.target.value as ReviewSort;
                setSort(next);
                void load(1, next, false);
              }}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {data ? (
        <ul className={`reviews__list ${loading === "reload" ? "is-loading" : ""}`} aria-busy={loading === "reload"}>
          {data.items.map((r) => (
            <li key={r.id} className="review">
              <div className="review__meta">
                <Stars rating={r.rating} />
                <span className="small muted">{formatDate(r.createdAt)}</span>
              </div>
              {r.title ? <h3 className="review__title">{r.title}</h3> : null}
              <p className="review__body">{r.body}</p>
              <p className="review__by">
                <span>
                  <span className="review__author">{r.author}</span>
                  {r.location ? <span className="muted">, {r.location}</span> : null}
                </span>
                {r.verifiedPurchase ? (
                  <span className="badge badge--success review__verified">
                    <Icon name="check" size={12} /> Verified buyer
                  </span>
                ) : null}
              </p>
              {r.reply ? (
                <p className="review__reply small">
                  <strong>Reply from Queen Luxury Hair:</strong> {r.reply}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {loadError ? (
        <div className="reviews__error" role="alert">
          <p>{loadError}</p>
          <button type="button" className="btn btn--ghost btn--sm" disabled={loading !== null} onClick={() => void load(data ? data.page + 1 : 1, sort, Boolean(data))}>
            {loading ? <span className="spinner" aria-hidden /> : null}
            Try again
          </button>
        </div>
      ) : null}

      {data && !loadError && data.page < data.totalPages ? (
        <div className="reviews__more">
          <button type="button" className="btn btn--ghost" onClick={() => void load(data.page + 1, sort, true)} disabled={loading !== null}>
            {loading === "more" ? <span className="spinner" aria-hidden /> : null}
            Show more reviews
          </button>
        </div>
      ) : null}
    </section>
  );
}

function Distribution({ summary }: { summary: ReviewSummary }) {
  const max = Math.max(1, summary.count);
  return (
    <ul className="reviews__bars" aria-label="Rating breakdown">
      {(["5", "4", "3", "2", "1"] as const).map((star) => {
        const n = summary.distribution[star] ?? 0;
        return (
          <li key={star} className="reviews__bar">
            <span className="small">{star} ★</span>
            <span className="reviews__track" aria-hidden>
              <span className="reviews__fill" style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className="small muted">
              {n}
              <span className="sr-only">
                {" "}
                {n === 1 ? "review" : "reviews"} with {star} {star === "1" ? "star" : "stars"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ form */

type FormState = { author: string; email: string; location: string; rating: number; title: string; body: string };
type Outcome = { kind: "submitted"; result: ReviewSubmission } | { kind: "exists"; message: string };

const L = REVIEW_LIMITS;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Client-side checks for quick feedback. The backend validates again and has the final say. */
export function validateReview(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  const author = f.author.trim();
  if (!Number.isInteger(f.rating) || f.rating < 1 || f.rating > 5) e.rating = "Choose a star rating.";
  if (author.length < L.authorMin) e.author = "Enter the name to show on your review.";
  else if (author.length > L.authorMax) e.author = `Keep your name under ${L.authorMax} characters.`;
  if (!EMAIL.test(f.email.trim())) e.email = "Enter a valid email address.";
  if (f.location.trim().length > L.locationMax) e.location = `Keep the city under ${L.locationMax} characters.`;
  if (f.title.trim().length > L.titleMax) e.title = `Keep the title under ${L.titleMax} characters.`;
  const body = f.body.trim().length;
  if (body < L.bodyMin) e.body = `Tell us a little more (at least ${L.bodyMin} characters).`;
  else if (body > L.bodyMax) e.body = `Keep your review under ${L.bodyMax} characters.`;
  return e;
}

function ReviewForm({ productId, productTitle, onClose, onPublished }: { productId: string; productTitle: string; onClose(): void; onPublished(): void }) {
  const [form, setForm] = useState<FormState>({ author: "", email: "", location: "", rating: 0, title: "", body: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<{ message: string; signIn?: boolean } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const inFlight = useRef(false);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setSignedIn(localStorage.getItem(SIGNED_IN_KEY) === "1");
    } catch {
      /* storage blocked: treat as guest */
    }
  }, []);

  useEffect(() => {
    if (outcome) statusRef.current?.focus();
  }, [outcome]);

  if (outcome) return <ReviewOutcome ref={statusRef} outcome={outcome} signedIn={signedIn} onClose={onClose} />;

  const set = (k: Exclude<keyof FormState, "rating">) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
    if (errors[k]) setErrors(({ [k]: _drop, ...rest }) => rest);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    const found = validateReview(form);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) {
      setFormError({ message: "Check the highlighted fields." });
      return;
    }
    inFlight.current = true;
    setSending(true);
    const body: ReviewInput = {
      author: form.author.trim(),
      email: form.email.trim(),
      location: form.location.trim() || undefined,
      rating: form.rating,
      title: form.title.trim(),
      body: form.body.trim(),
    };
    try {
      const result = await api().call("createProductReview", { params: { productId }, body });
      setOutcome({ kind: "submitted", result });
      if (result.status === "approved") onPublished();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) setErrors(err.fields);
        if (err.status === 409) setOutcome({ kind: "exists", message: err.message || "You've already reviewed this product." });
        else if (err.status === 401) setFormError({ message: "Sign in to write a review.", signIn: true });
        else if (err.status === 429) setFormError({ message: "You've sent a few reviews in a short time. Please try again a little later." });
        else if (err.isUnavailable) setFormError({ message: "Reviews can't be submitted yet. Please try again later." });
        else setFormError({ message: errorMessage(err) });
      } else {
        setFormError({ message: errorMessage(err) });
      }
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  const bodyLength = form.body.trim().length;

  return (
    <form id="review-form" className="review-form" noValidate onSubmit={submit} aria-labelledby="review-form-title">
      <div>
        <h3 id="review-form-title" className="h3">
          Review {productTitle}
        </h3>
        <p className="small muted">Reviews are checked by our team before they appear. We never show your email.</p>
      </div>

      <fieldset className="rating-input" aria-describedby={errors.rating ? "rating-error" : undefined}>
        <legend className="field__label">Your rating</legend>
        <div className="cluster">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={`rating-input__star ${n <= form.rating ? "is-on" : ""}`}>
              <input
                type="radio"
                name="rating"
                value={n}
                checked={form.rating === n}
                onChange={() => {
                  setForm((f) => ({ ...f, rating: n }));
                  if (errors.rating) setErrors(({ rating: _drop, ...rest }) => rest);
                }}
                className="sr-only"
              />
              <Icon name="star" size={28} />
              <span className="sr-only">
                {n} star{n > 1 ? "s" : ""}
              </span>
            </label>
          ))}
          {form.rating ? <span className="small muted">{["", "Poor", "Fair", "Good", "Very good", "Excellent"][form.rating]}</span> : null}
        </div>
        {errors.rating ? (
          <p id="rating-error" className="field__error">
            {errors.rating}
          </p>
        ) : null}
      </fieldset>

      <div className="form-grid">
        <TextField label="Name shown on review" value={form.author} onChange={set("author")} error={errors.author} required autoComplete="name" maxLength={L.authorMax} />
        <TextField label="Email (never shown)" type="email" value={form.email} onChange={set("email")} error={errors.email} required autoComplete="email" hint="Used to check for a purchase and to contact you about this review." />
        <TextField label="City (optional)" value={form.location} onChange={set("location")} error={errors.location} maxLength={L.locationMax} autoComplete="address-level2" />
        <TextField label="Title (optional)" value={form.title} onChange={set("title")} error={errors.title} maxLength={L.titleMax} />
      </div>
      <TextAreaField
        label="Your review"
        value={form.body}
        onChange={set("body")}
        error={errors.body}
        required
        rows={5}
        maxLength={L.bodyMax}
        hint={`How did it install, wash and hold up? ${bodyLength}/${L.bodyMax} characters${bodyLength < L.bodyMin ? `, at least ${L.bodyMin}` : ""}.`}
      />

      {formError ? (
        <p className="field__error" role="alert">
          {formError.message}{" "}
          {formError.signIn ? <Link href={`/account?next=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname + "#reviews")}`}>Sign in</Link> : null}
        </p>
      ) : null}

      <div className="cluster">
        <button type="submit" className="btn" disabled={sending}>
          {sending ? <span className="spinner" aria-hidden /> : null}
          {sending ? "Sending" : "Submit review"}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onClose} disabled={sending}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Says exactly what the backend reported. Nothing here claims more than the response did. */
function ReviewOutcome({ outcome, signedIn, onClose, ref }: { outcome: Outcome; signedIn: boolean; onClose(): void; ref: React.Ref<HTMLDivElement> }) {
  let tone = "info";
  let title: string;
  let body: React.ReactNode;
  if (outcome.kind === "exists") {
    title = "You've already reviewed this product";
    body = <p>{outcome.message}</p>;
  } else if (outcome.result.status === "approved") {
    tone = "success";
    title = "Your review is live";
    body = <p>Thank you. It now appears with the other reviews below.</p>;
  } else if (outcome.result.status === "rejected") {
    tone = "warning";
    title = "We couldn't publish this review";
    body = <p>{outcome.result.rejectionReason || "It doesn't meet our review guidelines. You're welcome to edit it and try again."}</p>;
  } else {
    title = "Thanks, your review is waiting for approval";
    body = (
      <p>
        Our team checks every review before it appears, usually within a day.{" "}
        {signedIn ? (
          <>
            You can follow its status under <Link href="/account#reviews">My reviews</Link>.
          </>
        ) : (
          "Reviews you write while signed in can be tracked from your account."
        )}
      </p>
    );
  }
  return (
    <div ref={ref} tabIndex={-1} className={`review-outcome review-outcome--${tone}`} role="status">
      <p className="review-outcome__title">{title}</p>
      {body}
      <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
