"use client";

import { useState } from "react";
import { RequirePermission } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { useToast } from "@/components/admin/Toast";
import { Empty, LoadError, LoadingRows, PageHeader, StatusBadge } from "@/components/admin/ui";
import { SelectField, TextAreaField } from "@/components/ui/Field";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import type { Inquiry, InquiryStatus } from "@/lib/types";

function Inbox() {
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

export default function InquiriesPage() {
  return (
    <RequirePermission permission="inquiries:respond">
      <PageHeader title="Messages" description="Questions customers sent from your contact page. Your reply is emailed to them." />
      <Inbox />
    </RequirePermission>
  );
}
