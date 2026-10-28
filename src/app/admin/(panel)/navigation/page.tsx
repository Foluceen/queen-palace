"use client";

import { useEffect, useState } from "react";
import { RequirePermission } from "@/components/admin/AdminSession";
import { useResource, useUnsavedWarning } from "@/components/admin/hooks";
import { useToast } from "@/components/admin/Toast";
import { LoadError, LoadingRows, PageHeader, Panel } from "@/components/admin/ui";
import { TextField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import type { Collection, Navigation, NavItem } from "@/lib/types";

const rid = () => `nav_${Math.random().toString(36).slice(2, 8)}`;

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const next = [...list];
  const [it] = next.splice(i, 1);
  next.splice(i + d, 0, it!);
  return next;
}

function ItemRows({ items, onChange, childLabel, collections }: { items: NavItem[]; onChange(items: NavItem[]): void; childLabel?: string; collections: Collection[] }) {
  return (
    <ol className="astack anav-list">
      {items.map((item, i) => (
        <li key={item.id} className="anav-item">
          <div className="aoption-row aoption-row--nav">
            <div className="acoll__order">
              <button type="button" className="icon-btn" disabled={i === 0} onClick={() => onChange(move(items, i, -1))} aria-label={`Move ${item.label || "link"} up`}>
                <Icon name="arrowUp" size={16} />
              </button>
              <button type="button" className="icon-btn" disabled={i === items.length - 1} onClick={() => onChange(move(items, i, 1))} aria-label={`Move ${item.label || "link"} down`}>
                <Icon name="arrowDown" size={16} />
              </button>
            </div>
            <TextField label="Label" value={item.label} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <TextField label="Link" value={item.href} list="nav-links" onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)))} />
            <button type="button" className="icon-btn" aria-label={`Remove ${item.label || "link"}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <Icon name="trash" size={16} />
            </button>
          </div>
          {childLabel ? (
            <div className="anav-children">
              {item.children?.length ? (
                <ItemRows items={item.children} collections={collections} onChange={(children) => onChange(items.map((x, j) => (j === i ? { ...x, children } : x)))} />
              ) : null}
              <button type="button" className="link-btn small" onClick={() => onChange(items.map((x, j) => (j === i ? { ...x, children: [...(x.children ?? []), { id: rid(), label: "", href: "/" }] } : x)))}>
                {childLabel}
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function NavigationPageInner() {
  const toast = useToast();
  const nav = useResource(() => api().call("adminGetNavigation"));
  const cols = useResource(() => api().call("adminListCollections"));
  const [draft, setDraft] = useState<Navigation | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  useUnsavedWarning(dirty);

  useEffect(() => {
    if (nav.data) setDraft(nav.data);
  }, [nav.data]);

  if (nav.error) return <LoadError message={nav.error} onRetry={nav.reload} />;
  if (!draft) return <LoadingRows rows={8} />;

  const change = (n: Navigation) => {
    setDraft(n);
    setDirty(true);
  };
  const collections = cols.data ?? [];

  const save = async () => {
    setSaving(true);
    try {
      setDraft(await api().call("adminUpdateNavigation", { body: draft }));
      setDirty(false);
      toast("Navigation saved. The store updates within a minute.");
    } catch (err) {
      toast(errorMessage(err), "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Navigation"
        description="The header menu, its dropdowns, and the footer link groups."
        actions={
          <button type="button" className="btn" onClick={save} disabled={saving || !dirty}>
            {saving ? <span className="spinner" aria-hidden /> : null}
            Save changes
          </button>
        }
      />
      {/* Suggestions for link fields: every page and published collection. */}
      <datalist id="nav-links">
        {["/", "/collections", "/search", "/search?sort=newest", "/search?sort=best_selling", "/about", "/contact", "/hair-care", "/faq", "/shipping", "/returns", "/privacy", "/terms", "/account", ...collections.map((c) => `/collections/${c.handle}`)].map((h) => (
          <option key={h} value={h} />
        ))}
      </datalist>
      <div className="aeditor">
        <div className="aeditor__main">
          <Panel
            title="Header menu"
            actions={
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => change({ ...draft, main: [...draft.main, { id: rid(), label: "New link", href: "/" }] })}>
                Add menu link
              </button>
            }
          >
            <ItemRows items={draft.main} collections={collections} onChange={(main) => change({ ...draft, main })} childLabel="Add dropdown link" />
          </Panel>
        </div>
        <aside className="aeditor__side">
          <Panel
            title="Footer"
            actions={
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => change({ ...draft, footer: [...draft.footer, { id: rid(), title: "New group", items: [] }] })}>
                Add group
              </button>
            }
          >
            <div className="astack">
              {draft.footer.map((g, gi) => (
                <fieldset key={g.id} className="afieldset">
                  <div className="aoption-row">
                    <TextField label="Group title" value={g.title} onChange={(e) => change({ ...draft, footer: draft.footer.map((x, j) => (j === gi ? { ...x, title: e.target.value } : x)) })} />
                    <button type="button" className="icon-btn" aria-label={`Remove ${g.title}`} onClick={() => change({ ...draft, footer: draft.footer.filter((_, j) => j !== gi) })}>
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                  <ItemRows items={g.items} collections={collections} onChange={(items) => change({ ...draft, footer: draft.footer.map((x, j) => (j === gi ? { ...x, items } : x)) })} />
                  <button type="button" className="link-btn small" onClick={() => change({ ...draft, footer: draft.footer.map((x, j) => (j === gi ? { ...x, items: [...x.items, { id: rid(), label: "", href: "/" }] } : x)) })}>
                    Add link
                  </button>
                </fieldset>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}

export default function NavigationPage() {
  return (
    <RequirePermission permission="content:write">
      <NavigationPageInner />
    </RequirePermission>
  );
}
