"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAdmin } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { useToast } from "@/components/admin/Toast";
import { Empty, LoadError, LoadingRows, PageHeader, StatusBadge } from "@/components/admin/ui";
import { SelectField, TextAreaField } from "@/components/ui/Field";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import type { Inquiry, InquiryStatus, Review, ReviewStatus } from "@/lib/types";

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

function MessagesTab() {
  const toast = useToast();
  const [status, setStatus] = useState<InquiryStatus | "">("");
  const { data, setData, error, loading, reload } = useResource(() => api().call("adminListInquiries", { query: { status: status || undefined } }), [status]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const update = async (i: Inquiry, body: { status?: InquiryStatus; reply?: string }) => {
    setBusy(true);
    try {
      const updated = await api().call("adminUpdateInquiry", { params: { id: i.id }, body });
      setData((list) => list?.map((x) => (x.id === i.id ? updated : x)) ?? null);
      if (body.reply) {
        setReply("");
        toast("Reply recorded. Mock mode doesn't send email; the live backend emails the customer.");
      } else toast("Message updated");
    } catch (err) {
      toast(errorMessage(err), "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="afilters">
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value as InquiryStatus | "")} aria-label="Message status">
          <option value="">All messages</option>
          <option value="new">New</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingRows /> : null}
      {data ? (
        data.length ? (
          <ul className="ainbox">
            {data.map((i) => (
              <li key={i.id} className={`apanel ainbox__item ${i.status === "new" ? "is-new" : ""}`}>
                <button type="button" className="ainbox__summary" aria-expanded={openId === i.id} onClick={() => setOpenId(openId === i.id ? null : i.id)}>
                  <span>
                    <strong>{i.name}</strong> <span className="muted small">{i.topic}{i.orderNumber ? `, ${i.orderNumber}` : ""}</span>
                  </span>
                  <span className="ainbox__preview small">{i.message}</span>
                  <span className="cluster" style={{ ["--cluster" as string]: "8px" }}>
                    <StatusBadge tone={i.status === "new" ? "warning" : i.status === "open" ? "info" : "neutral"}>{i.status}</StatusBadge>
                    <span className="small muted">{formatDateTime(i.createdAt)}</span>
                  </span>
                </button>
                {openId === i.id ? (
                  <div className="ainbox__thread">
                    <p>{i.message}</p>
                    <p className="small">
                      <a href={`mailto:${i.email}`}>{i.email}</a>
                      {i.phone ? (
                        <>
                          {" "}
                          or <a href={`tel:${i.phone}`}>{i.phone}</a>
                        </>
                      ) : null}
                    </p>
                    {i.replies.map((r) => (
                      <div key={r.id} className="ainbox__reply">
                        <p className="small muted">
                          {r.author}, {formatDateTime(r.createdAt)}
                        </p>
                        <p>{r.body}</p>
                      </div>
                    ))}
                    <TextAreaField label="Reply" value={reply} onChange={(e) => setReply(e.target.value)} rows={3} />
                    <div className="cluster">
                      <button type="button" className="btn btn--sm" disabled={busy || !reply.trim()} onClick={() => void update(i, { reply })}>
                        Send reply
                      </button>
                      <SelectField label="Status" value={i.status} onChange={(e) => void update(i, { status: e.target.value as InquiryStatus })} wrapperClassName="ainline-field">
                        <option value="new">New</option>
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                      </SelectField>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="Inbox zero" body="Messages from the contact form appear here." />
        )
      ) : null}
    </>
  );
}

function ReviewsAndMessages() {
  const { can } = useAdmin();
  const sp = useSearchParams();
  const router = useRouter();
  const canReviews = can("reviews:moderate");
  const canMessages = can("inquiries:respond");
  const tab = sp.get("tab") === "messages" || !canReviews ? "messages" : "reviews";

  if (!canReviews && !canMessages) {
    return (
      <div className="admin-denied">
        <h1 className="h2">You don't have access to this section</h1>
      </div>
    );
  }
  return (
    <>
      <PageHeader title="Reviews and messages" description="Approve reviews before they appear on the store, and reply to customer messages." />
      <div className="atabs" role="tablist">
        {canReviews ? (
          <button type="button" role="tab" aria-selected={tab === "reviews"} className={`atab ${tab === "reviews" ? "is-on" : ""}`} onClick={() => router.replace("/admin/reviews")}>
            Reviews
          </button>
        ) : null}
        {canMessages ? (
          <button type="button" role="tab" aria-selected={tab === "messages"} className={`atab ${tab === "messages" ? "is-on" : ""}`} onClick={() => router.replace("/admin/reviews?tab=messages")}>
            Messages
          </button>
        ) : null}
      </div>
      {tab === "reviews" ? <ReviewsTab /> : <MessagesTab />}
    </>
  );
}

export default function ReviewsPage() {
  return (
    <Suspense>
      <ReviewsAndMessages />
    </Suspense>
  );
}
