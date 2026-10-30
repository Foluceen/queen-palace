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

const STATUS_LABEL: Record<ReviewStatus, string> = { pending: "Waiting for approval", approved: "Approved", rejected: "Rejected" };
const STATUS_TONE = { pending: "warning", approved: "success", rejected: "neutral" } as const;

function ReviewsTab() {
  const toast = useToast();
  const [status, setStatus] = useState<ReviewStatus | "">("pending");
  const { data, setData, error, loading, reload } = useResource(() => api().call("adminListReviews", { query: { status: status || undefined } }), [status]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const moderate = async (r: Review, next: ReviewStatus) => {
    setBusy(r.id);
    try {
      const updated = await api().call("adminModerateReview", {
        params: { id: r.id },
        body: {
          status: next,
          reply: replies[r.id] ?? r.reply,
          ...(next === "rejected" ? { rejectionReason: (reasons[r.id] ?? r.rejectionReason ?? "").trim() || null } : {}),
        },
      });
      setData((list) => list?.map((x) => (x.id === r.id ? updated : x)).filter((x) => !status || x.status === status) ?? null);
      toast(next === r.status ? "Review saved" : next === "approved" ? "Review approved and published" : next === "rejected" ? "Review rejected" : "Review moved back to waiting");
    } catch (err) {
      toast(errorMessage(err), "danger");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="afilters">
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value as ReviewStatus | "")} aria-label="Review status">
          <option value="pending">Waiting for approval</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
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
                  <strong>{r.title || "Untitled review"}</strong>
                  <StatusBadge tone={STATUS_TONE[r.status] ?? "neutral"}>{STATUS_LABEL[r.status] ?? r.status}</StatusBadge>
                </div>
                <p>{r.body}</p>
                <p className="small muted">
                  {r.author}
                  {r.location ? `, ${r.location}` : ""} on {r.productTitle}, {formatDateTime(r.createdAt)}
                  {r.verifiedPurchase ? ", verified buyer" : ""}
                  {r.moderatedAt ? `. Last moderated ${formatDateTime(r.moderatedAt)}` : ""}
                </p>
                <TextAreaField
                  label="Public reply (optional)"
                  hint="Shown under the review once it's approved."
                  value={replies[r.id] ?? r.reply ?? ""}
                  onChange={(e) => setReplies((x) => ({ ...x, [r.id]: e.target.value }))}
                  rows={2}
                />
                {r.status !== "approved" ? (
                  <TextAreaField
                    label="Reason if rejected (optional)"
                    hint="Only the customer who wrote it sees this, in their account."
                    value={reasons[r.id] ?? r.rejectionReason ?? ""}
                    onChange={(e) => setReasons((x) => ({ ...x, [r.id]: e.target.value }))}
                    rows={2}
                    maxLength={300}
                  />
                ) : null}
                <div className="cluster">
                  {r.status !== "approved" ? (
                    <button type="button" className="btn btn--sm" disabled={busy === r.id} onClick={() => void moderate(r, "approved")}>
                      Approve
                    </button>
                  ) : (
                    <button type="button" className="btn btn--ghost btn--sm" disabled={busy === r.id} onClick={() => void moderate(r, "approved")}>
                      Save reply
                    </button>
                  )}
                  {r.status !== "rejected" ? (
                    <button type="button" className="btn btn--ghost btn--sm" disabled={busy === r.id} onClick={() => void moderate(r, "rejected")}>
                      Reject
                    </button>
                  ) : (
                    <button type="button" className="btn btn--ghost btn--sm" disabled={busy === r.id} onClick={() => void moderate(r, "rejected")}>
                      Save reason
                    </button>
                  )}
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
      <PageHeader title="Reviews" description="New reviews wait here. Approve to show one in your shop, or Reject to hide it. Star ratings only count approved reviews." />
      <ReviewsTab />
    </RequirePermission>
  );
}
