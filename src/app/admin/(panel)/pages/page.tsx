"use client";

import { useEffect, useState } from "react";
import { RequirePermission } from "@/components/admin/AdminSession";
import { useResource, useUnsavedWarning } from "@/components/admin/hooks";
import { useToast } from "@/components/admin/Toast";
import { LoadError, LoadingRows, PageHeader, Panel, StatusBadge, Switch } from "@/components/admin/ui";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import type { ContentBlock, ContentPage } from "@/lib/types";

const blockLabel: Record<ContentBlock["kind"], string> = { heading: "Heading", paragraph: "Paragraph", list: "Bullet list", qa: "Question and answer" };

const emptyBlock = (kind: ContentBlock["kind"]): ContentBlock =>
  kind === "list" ? { kind, items: [""] } : kind === "qa" ? { kind, question: "", answer: "" } : { kind, text: "" };

function BlockEditor({ block, onChange }: { block: ContentBlock; onChange(b: ContentBlock): void }) {
  switch (block.kind) {
    case "heading":
      return <TextField label="Heading" value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} />;
    case "paragraph":
      return <TextAreaField label="Paragraph" rows={4} value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} />;
    case "list":
      return <TextAreaField label="Bullet list" rows={4} value={block.items.join("\n")} onChange={(e) => onChange({ ...block, items: e.target.value.split("\n") })} hint="One item per line." />;
    case "qa":
      return (
        <div className="astack">
          <TextField label="Question" value={block.question} onChange={(e) => onChange({ ...block, question: e.target.value })} />
          <TextAreaField label="Answer" rows={3} value={block.answer} onChange={(e) => onChange({ ...block, answer: e.target.value })} />
        </div>
      );
  }
}

function PageEditor({ page, onSaved }: { page: ContentPage; onSaved(p: ContentPage): void }) {
  const toast = useToast();
  const [d, setD] = useState(page);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addKind, setAddKind] = useState<ContentBlock["kind"]>(page.blocks.some((b) => b.kind === "qa") ? "qa" : "paragraph");
  useUnsavedWarning(dirty);

  const change = (patch: Partial<ContentPage>) => {
    setD({ ...d, ...patch });
    setDirty(true);
  };
  const setBlocks = (blocks: ContentBlock[]) => change({ blocks });

  const save = async () => {
    setSaving(true);
    try {
      const blocks = d.blocks.map((b) => (b.kind === "list" ? { ...b, items: b.items.map((i) => i.trim()).filter(Boolean) } : b));
      const saved = await api().call("adminSavePage", { params: { slug: d.slug }, body: { title: d.title, intro: d.intro, blocks, reviewed: d.reviewed } });
      setD(saved);
      setDirty(false);
      onSaved(saved);
      toast(`${saved.title} saved`);
    } catch (err) {
      toast(errorMessage(err), "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title={`/${d.slug}`}
      actions={
        <div className="cluster">
          <a href={`/${d.slug}`} target="_blank" className="btn btn--ghost btn--sm">
            View
          </a>
          <button type="button" className="btn btn--sm" onClick={save} disabled={saving || !dirty}>
            {saving ? <span className="spinner" aria-hidden /> : null}
            Save page
          </button>
        </div>
      }
    >
      <div className="astack">
        {!d.reviewed ? (
          <p className="notice notice--warning small">
            This is starter text. Check every statement matches how Queen Luxury Hair actually works (fees, timings, what can be returned), then mark it reviewed. Until then the store shows a short “being finalised” note on the page.
          </p>
        ) : null}
        <Switch checked={d.reviewed} onChange={(v) => change({ reviewed: v })} label="I've reviewed this page and it is accurate" />
        <TextField label="Title" value={d.title} onChange={(e) => change({ title: e.target.value })} />
        <TextAreaField label="Introduction" rows={2} value={d.intro} onChange={(e) => change({ intro: e.target.value })} />
        <ol className="ablocks">
          {d.blocks.map((b, i) => (
            <li key={i} className="ablock">
              <div className="ablock__head">
                <span className="badge">{blockLabel[b.kind]}</span>
                <div className="cluster">
                  <button type="button" className="icon-btn" disabled={i === 0} aria-label="Move up" onClick={() => setBlocks(d.blocks.map((x, j) => (j === i - 1 ? d.blocks[i]! : j === i ? d.blocks[i - 1]! : x)))}>
                    <Icon name="arrowUp" size={16} />
                  </button>
                  <button type="button" className="icon-btn" disabled={i === d.blocks.length - 1} aria-label="Move down" onClick={() => setBlocks(d.blocks.map((x, j) => (j === i + 1 ? d.blocks[i]! : j === i ? d.blocks[i + 1]! : x)))}>
                    <Icon name="arrowDown" size={16} />
                  </button>
                  <button type="button" className="icon-btn" aria-label="Remove block" onClick={() => setBlocks(d.blocks.filter((_, j) => j !== i))}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>
              <BlockEditor block={b} onChange={(nb) => setBlocks(d.blocks.map((x, j) => (j === i ? nb : x)))} />
            </li>
          ))}
        </ol>
        <div className="cluster">
          <select className="select select--sm" value={addKind} onChange={(e) => setAddKind(e.target.value as ContentBlock["kind"])} aria-label="Block type">
            {Object.entries(blockLabel).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setBlocks([...d.blocks, emptyBlock(addKind)])}>
            Add block
          </button>
        </div>
        <p className="small muted">Last saved {formatDateTime(d.updatedAt)}</p>
      </div>
    </Panel>
  );
}

function PagesInner() {
  const { data, setData, error, loading, reload } = useResource(() => api().call("adminListPages"));
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    if (data && !slug) setSlug(data[0]?.slug ?? null);
  }, [data, slug]);

  const current = data?.find((p) => p.slug === slug);
  const toReview = data?.filter((p) => !p.reviewed).length ?? 0;

  return (
    <>
      <PageHeader title="Pages" description={toReview ? `${toReview} ${toReview === 1 ? "page needs" : "pages need"} your review before launch.` : "About, hair care, FAQ and your policies."} />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingRows /> : null}
      {data ? (
        <div className="aeditor aeditor--list">
          <aside className="aeditor__side">
            <ul className="apagelist" role="tablist" aria-label="Pages">
              {data.map((p) => (
                <li key={p.slug}>
                  <button type="button" role="tab" aria-selected={p.slug === slug} className={`apagelist__item ${p.slug === slug ? "is-on" : ""}`} onClick={() => setSlug(p.slug)}>
                    <span>{p.title}</span>
                    {p.reviewed ? <StatusBadge tone="success">Reviewed</StatusBadge> : <StatusBadge tone="warning">Needs review</StatusBadge>}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <div className="aeditor__main">{current ? <PageEditor key={current.slug} page={current} onSaved={(p) => setData((list) => list?.map((x) => (x.slug === p.slug ? p : x)) ?? null)} /> : null}</div>
        </div>
      ) : null}
    </>
  );
}

export default function PagesAdminPage() {
  return (
    <RequirePermission permission="content:write">
      <PagesInner />
    </RequirePermission>
  );
}
