"use client";

import { useState } from "react";
import { RequirePermission } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { useToast } from "@/components/admin/Toast";
import { Empty, LoadError, LoadingRows, PageHeader, StatusBadge } from "@/components/admin/ui";
import { TextAreaField } from "@/components/ui/Field";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import type { Review, ReviewStatus } from "@/lib/types";

function ReviewsTab() {
  const toast = useToast();
  const [status, setStatus] = useState<ReviewStatus | "">("pending");
  const { data, setData, error, loading, reload } = useResource(() => api().call("adminListReviews", { query: { status: status || undefined } }), [status]);
  const [replies, setReplies] = useState<Record<string, string>>({});

  const moderate = async (r: Review, next: ReviewStatus, reply?: string) => {
    try {
      const updated = await api().call("adminModerateReview", { params: { id: r.id }, body: { status: next, reply } });
      setData((list) => list?.map((x) => (x.id === r.id ? updated : x)).filter((x) => !status || x.status === status) ?? null);
      toast(next === "published" ? "Review published" : next === "hidden" ? "Review hidden" : "Review saved");
    } catch (err) {
      toast(errorMessage(err), "danger");
    }
  };

  return (
    <>
      <div className="afilters">
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value as ReviewStatus | "")} aria-label="Review status">
          <option value="pending">Waiting for approval</option>
          <option value="published">Published</option>
          <option value="hidden">Hidden</option>
          <option value="">All reviews</option>
        </select>
      </div>
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingRows /> : null}
      {data ? (
        data.length ? (
          <ul className="areviews">
            {data.map((r) => (
              <li key={r.id} className="apanel">
                <div className="areview__head">
                  <span className="areview__stars" role="img" aria-label={`${r.rating} out of 5`}>
                    {"★★★★★".slice(0, r.rating)}
                    <span className="muted">{"★★★★★".slice(r.rating)}</span>
                  </span>
                  <strong>{r.title}</strong>
                  <StatusBadge tone={r.status === "published" ? "success" : r.status === "pending" ? "warning" : "neutral"}>{r.status}</StatusBadge>
                </div>
                <p>{r.body}</p>
                <p className="small muted">
                  {r.author}
                  {r.location ? `, ${r.location}` : ""} on {r.productTitle}, {formatDateTime(r.createdAt)}
                  {r.verifiedPurchase ? ", verified buyer" : ""}
                </p>
                <TextAreaField label="Public reply (optional)" value={replies[r.id] ?? r.reply ?? ""} onChange={(e) => setReplies((x) => ({ ...x, [r.id]: e.target.value }))} rows={2} />
                <div className="cluster">
                  {r.status !== "published" ? (
                    <button type="button" className="btn btn--sm" onClick={() => void moderate(r, "published", replies[r.id])}>
                      Publish
                    </button>
                  ) : (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => void moderate(r, "published", replies[r.id])}>
                      Save reply
                    </button>
                  )}
                  {r.status !== "hidden" ? (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => void moderate(r, "hidden", replies[r.id])}>
                      Hide
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title={status === "pending" ? "No reviews waiting" : "No reviews here"} body={status === "pending" ? "New reviews appear here before they go live." : undefined} />
        )
      ) : null}
    </>
  );
}

export default function ReviewsPage() {
  return (
    <RequirePermission permission="reviews:moderate">
      <PageHeader title="Reviews" description="Customer reviews wait here for approval before they appear on the store. Ratings are calculated only from published reviews." />
      <ReviewsTab />
    </RequirePermission>
  );
}
