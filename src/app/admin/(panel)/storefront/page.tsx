"use client";

import { useEffect, useState } from "react";
import { RequirePermission } from "@/components/admin/AdminSession";
import { useResource, useUnsavedWarning } from "@/components/admin/hooks";
import { ImageField } from "@/components/admin/MediaPicker";
import { useToast } from "@/components/admin/Toast";
import { LoadError, LoadingRows, PageHeader, Panel, Switch } from "@/components/admin/ui";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import type { Collection, HomepageSection, HomepageSectionType } from "@/lib/types";

const typeLabel: Record<HomepageSectionType, string> = {
  hero: "Hero",
  marquee: "Scrolling strip",
  collections: "Collections",
  product_rail: "Product row",
  editorial: "Story with image",
  shade_guide: "Shade guide",
  reviews: "Customer reviews",
  promises: "Trust badges",
  cta_band: "Call to action",
  promo: "Promotion banner",
  testimonials: "Testimonials",
  care_tips: "Hair care tips",
  faq: "FAQ preview",
  newsletter: "Newsletter sign-up",
};

function newSection(type: HomepageSectionType): HomepageSection {
  const base = { id: `sec_${Math.random().toString(36).slice(2, 9)}`, enabled: true, position: 0 };
  switch (type) {
    case "hero":
      return { ...base, type, heading: "New hero", body: "", primaryCta: { label: "Shop now", href: "/collections" }, secondaryCta: null, image: null, layerImage: null, stats: [] };
    case "marquee":
      return { ...base, type, items: ["New phrase"] };
    case "collections":
      return { ...base, type, heading: "Shop by collection", body: "", collectionIds: [] };
    case "product_rail":
      return { ...base, type, heading: "Featured", body: "", source: { kind: "featured" }, limit: 4 };
    case "editorial":
      return { ...base, type, heading: "A story", body: "", image: null, cta: null, imageSide: "right" };
    case "shade_guide":
      return { ...base, type, heading: "Find your shade", body: "", shades: [{ code: "1B", name: "Off black", hex: "#1E1614" }] };
    case "reviews":
      return { ...base, type, heading: "What customers say" };
    case "promises":
      return { ...base, type, items: [{ title: "Checked before it ships", body: "" }] };
    case "cta_band":
      return { ...base, type, heading: "Need help choosing?", body: "", cta: { label: "Chat with us", href: "/contact" }, whatsapp: true };
    case "promo":
      return { ...base, type, heading: "New promotion", body: "", cta: { label: "Shop now", href: "/collections" }, image: null, code: null, endsAt: null, tone: "burgundy" };
    case "testimonials":
      return { ...base, type, heading: "Words from our queens", items: [] };
    case "care_tips":
      return { ...base, type, heading: "Care for your hair", body: "", tips: [{ title: "", body: "" }], cta: { label: "Hair care guide", href: "/hair-care" } };
    case "faq":
      return { ...base, type, heading: "Questions, answered", limit: 4 };
    case "newsletter":
      return { ...base, type, heading: "Be first to know", body: "New arrivals and offers, now and then. Unsubscribe any time." };
  }
}

function lines(v: string) {
  return v.split("\n").map((s) => s.trim()).filter(Boolean);
}

function SectionFields({ s, onChange, collections }: { s: HomepageSection; onChange(next: HomepageSection): void; collections: Collection[] }) {
  switch (s.type) {
    case "hero":
      return (
        <div className="astack">
          <TextAreaField label="Headline" value={s.heading} onChange={(e) => onChange({ ...s, heading: e.target.value })} rows={2} hint="The last word is set in the accent colour." />
          <TextAreaField label="Supporting line" value={s.body} onChange={(e) => onChange({ ...s, body: e.target.value })} rows={2} />
          <div className="form-grid">
            <TextField label="Main button label" value={s.primaryCta.label} onChange={(e) => onChange({ ...s, primaryCta: { ...s.primaryCta, label: e.target.value } })} />
            <TextField label="Main button link" value={s.primaryCta.href} onChange={(e) => onChange({ ...s, primaryCta: { ...s.primaryCta, href: e.target.value } })} />
            <TextField label="Second button label" value={s.secondaryCta?.label ?? ""} onChange={(e) => onChange({ ...s, secondaryCta: e.target.value ? { label: e.target.value, href: s.secondaryCta?.href ?? "/collections" } : null })} hint="Leave empty to hide." />
            <TextField label="Second button link" value={s.secondaryCta?.href ?? ""} onChange={(e) => onChange({ ...s, secondaryCta: s.secondaryCta ? { ...s.secondaryCta, href: e.target.value } : null })} disabled={!s.secondaryCta} />
          </div>
          <div className="form-grid">
            <ImageField label="Large image" value={s.image} onChange={(image) => onChange({ ...s, image })} />
            <ImageField label="Front image" value={s.layerImage} onChange={(layerImage) => onChange({ ...s, layerImage })} />
          </div>
          <fieldset className="afieldset">
            <legend className="field__label">Facts under the hero</legend>
            <p className="small muted">Use real facts only. Live counts are filled in by the store from your catalog, so they never go out of date.</p>
            {(s.stats ?? []).map((st, i) => (
              <div key={i} className="aoption-row aoption-row--4">
                <SelectField label="Number from" value={st.source} onChange={(e) => onChange({ ...s, stats: s.stats.map((x, j) => (j === i ? { ...x, source: e.target.value as typeof st.source } : x)) })}>
                  <option value="custom">A number I type</option>
                  <option value="collections">Live: published collections</option>
                  <option value="products">Live: published products</option>
                </SelectField>
                <TextField label="Number" type="number" value={String(st.value)} disabled={st.source !== "custom"} onChange={(e) => onChange({ ...s, stats: s.stats.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) || 0 } : x)) })} />
                <TextField label="After the number" value={st.suffix} onChange={(e) => onChange({ ...s, stats: s.stats.map((x, j) => (j === i ? { ...x, suffix: e.target.value } : x)) })} placeholder="+" />
                <TextField label="Label" value={st.label} onChange={(e) => onChange({ ...s, stats: s.stats.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                <button type="button" className="icon-btn" aria-label="Remove fact" onClick={() => onChange({ ...s, stats: s.stats.filter((_, j) => j !== i) })}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
            {(s.stats ?? []).length < 3 ? (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange({ ...s, stats: [...(s.stats ?? []), { source: "custom", value: 0, suffix: "", label: "" }] })}>
                Add fact
              </button>
            ) : null}
          </fieldset>
        </div>
      );
    case "marquee":
      return <TextAreaField label="Phrases" value={s.items.join("\n")} onChange={(e) => onChange({ ...s, items: lines(e.target.value) })} hint="One per line." rows={5} />;
    case "collections":
      return (
        <div className="astack">
          <TextField label="Heading" value={s.heading} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
          <TextField label="Supporting line" value={s.body} onChange={(e) => onChange({ ...s, body: e.target.value })} />
          <fieldset className="afieldset">
            <legend className="field__label">Collections to show</legend>
            <p className="small muted">Leave all unticked to show every published collection in your chosen order.</p>
            <ul className="achecks">
              {collections.map((c) => (
                <li key={c.id}>
                  <label className="checkbox">
                    <input type="checkbox" checked={s.collectionIds.includes(c.id)} onChange={(e) => onChange({ ...s, collectionIds: e.target.checked ? [...s.collectionIds, c.id] : s.collectionIds.filter((x) => x !== c.id) })} />
                    {c.title}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </div>
      );
    case "product_rail":
      return (
        <div className="astack">
          <TextField label="Heading" value={s.heading} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
          <TextField label="Supporting line" value={s.body} onChange={(e) => onChange({ ...s, body: e.target.value })} />
          <div className="form-grid">
            <SelectField
              label="Products from"
              value={s.source.kind === "collection" ? `collection:${s.source.collectionId}` : s.source.kind}
              onChange={(e) => {
                const v = e.target.value;
                onChange({ ...s, source: v.startsWith("collection:") ? { kind: "collection", collectionId: v.slice(11) } : v === "newest" ? { kind: "newest" } : v === "best_sellers" ? { kind: "best_sellers" } : { kind: "featured" } });
              }}
            >
              <option value="featured">Featured products</option>
              <option value="newest">Newest products</option>
              <option value="best_sellers">Best sellers (from paid orders)</option>
              {collections.map((c) => (
                <option key={c.id} value={`collection:${c.id}`}>
                  {c.title}
                </option>
              ))}
            </SelectField>
            <SelectField label="How many" value={String(s.limit)} onChange={(e) => onChange({ ...s, limit: Number(e.target.value) })}>
              {[4, 8, 12].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
      );
    case "editorial":
      return (
        <div className="astack">
          <TextField label="Heading" value={s.heading} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
          <TextAreaField label="Story" value={s.body} onChange={(e) => onChange({ ...s, body: e.target.value })} rows={4} />
          <div className="form-grid">
            <TextField label="Button label" value={s.cta?.label ?? ""} onChange={(e) => onChange({ ...s, cta: e.target.value ? { label: e.target.value, href: s.cta?.href ?? "/" } : null })} hint="Leave empty to hide." />
            <TextField label="Button link" value={s.cta?.href ?? ""} onChange={(e) => onChange({ ...s, cta: s.cta ? { ...s.cta, href: e.target.value } : null })} disabled={!s.cta} />
            <ImageField label="Image" value={s.image} onChange={(image) => onChange({ ...s, image })} />
            <SelectField label="Image side" value={s.imageSide} onChange={(e) => onChange({ ...s, imageSide: e.target.value as "left" | "right" })}>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </SelectField>
          </div>
        </div>
      );
    case "shade_guide":
      return (
        <div className="astack">
          <TextField label="Heading" value={s.heading} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
          <TextAreaField label="Supporting line" value={s.body} onChange={(e) => onChange({ ...s, body: e.target.value })} rows={2} />
          {s.shades.map((sh, i) => (
            <div key={i} className="aoption-row aoption-row--3">
              <TextField label="Code" value={sh.code} onChange={(e) => onChange({ ...s, shades: s.shades.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)) })} />
              <TextField label="Name" value={sh.name} onChange={(e) => onChange({ ...s, shades: s.shades.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <label className="field">
                <span className="field__label">Colour</span>
                <input type="color" className="acolor" value={sh.hex} onChange={(e) => onChange({ ...s, shades: s.shades.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)) })} />
              </label>
              <button type="button" className="icon-btn" aria-label={`Remove shade ${sh.code}`} onClick={() => onChange({ ...s, shades: s.shades.filter((_, j) => j !== i) })}>
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange({ ...s, shades: [...s.shades, { code: "", name: "", hex: "#1E1614" }] })}>
            Add shade
          </button>
        </div>
      );
    case "reviews":
      return (
        <div className="astack">
          <TextField label="Heading" value={s.heading} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
          <p className="small muted">Shows your latest published 4 and 5 star reviews. Approve reviews in Reviews and messages.</p>
        </div>
      );
    case "promises":
      return (
        <div className="astack">
          {s.items.map((it, i) => (
            <div key={i} className="aoption-row">
              <TextField label="Title" value={it.title} onChange={(e) => onChange({ ...s, items: s.items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
              <TextField label="Detail" value={it.body} onChange={(e) => onChange({ ...s, items: s.items.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} />
              <button type="button" className="icon-btn" aria-label="Remove badge" onClick={() => onChange({ ...s, items: s.items.filter((_, j) => j !== i) })}>
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
          {s.items.length < 3 ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange({ ...s, items: [...s.items, { title: "", body: "" }] })}>
              Add badge
            </button>
          ) : null}
        </div>
      );
    case "cta_band":
      return (
        <div className="astack">
          <TextField label="Heading" value={s.heading} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
          <TextAreaField label="Supporting line" value={s.body} onChange={(e) => onChange({ ...s, body: e.target.value })} rows={2} />
          <div className="form-grid">
            <TextField label="Button label" value={s.cta.label} onChange={(e) => onChange({ ...s, cta: { ...s.cta, label: e.target.value } })} />
            <TextField label="Button link" value={s.cta.href} onChange={(e) => onChange({ ...s, cta: { ...s.cta, href: e.target.value } })} disabled={s.whatsapp} hint={s.whatsapp ? "Opens WhatsApp instead." : undefined} />
          </div>
          <Switch checked={s.whatsapp} onChange={(v) => onChange({ ...s, whatsapp: v })} label="Open WhatsApp with the store number" />
          <p className="small muted">WhatsApp is only used once a number is set in Branding. Until then the button link is used.</p>
        </div>
      );
    case "promo":
      return (
        <div className="astack">
          <TextField label="Heading" value={s.heading} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
          <TextAreaField label="Details" value={s.body} onChange={(e) => onChange({ ...s, body: e.target.value })} rows={2} />
          <div className="form-grid">
            <TextField label="Button label" value={s.cta.label} onChange={(e) => onChange({ ...s, cta: { ...s.cta, label: e.target.value } })} />
            <TextField label="Button link" value={s.cta.href} onChange={(e) => onChange({ ...s, cta: { ...s.cta, href: e.target.value } })} />
            <TextField label="Discount code (optional)" value={s.code ?? ""} onChange={(e) => onChange({ ...s, code: e.target.value.toUpperCase() || null })} hint="Create the code in Discounts. Checkout validates it." />
            <TextField label="Hide after (optional)" type="datetime-local" value={s.endsAt ? s.endsAt.slice(0, 16) : ""} onChange={(e) => onChange({ ...s, endsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            <SelectField label="Colour" value={s.tone} onChange={(e) => onChange({ ...s, tone: e.target.value as typeof s.tone })}>
              <option value="burgundy">Burgundy</option>
              <option value="gold">Champagne gold</option>
              <option value="surface">Soft cream</option>
            </SelectField>
            <ImageField label="Image (optional)" value={s.image} onChange={(image) => onChange({ ...s, image })} />
          </div>
        </div>
      );
    case "testimonials":
      return (
        <div className="astack">
          <TextField label="Heading" value={s.heading} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
          <p className="notice notice--warning small">Only use real words from real customers, with their permission. Nothing is shown when the list is empty.</p>
          {s.items.map((t, i) => (
            <div key={t.id} className="afieldset">
              <TextAreaField label="Quote" value={t.quote} rows={2} onChange={(e) => onChange({ ...s, items: s.items.map((x, j) => (j === i ? { ...x, quote: e.target.value } : x)) })} />
              <div className="aoption-row">
                <TextField label="Name" value={t.name} onChange={(e) => onChange({ ...s, items: s.items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <TextField label="Town (optional)" value={t.location} onChange={(e) => onChange({ ...s, items: s.items.map((x, j) => (j === i ? { ...x, location: e.target.value } : x)) })} />
                <button type="button" className="icon-btn" aria-label="Remove testimonial" onClick={() => onChange({ ...s, items: s.items.filter((_, j) => j !== i) })}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange({ ...s, items: [...s.items, { id: `t_${Math.random().toString(36).slice(2, 8)}`, quote: "", name: "", location: "" }] })}>
            Add testimonial
          </button>
        </div>
      );
    case "care_tips":
      return (
        <div className="astack">
          <TextField label="Heading" value={s.heading} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
          <TextAreaField label="Supporting line" value={s.body} rows={2} onChange={(e) => onChange({ ...s, body: e.target.value })} />
          {s.tips.map((t, i) => (
            <div key={i} className="aoption-row">
              <TextField label="Tip" value={t.title} onChange={(e) => onChange({ ...s, tips: s.tips.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
              <TextField label="Detail" value={t.body} onChange={(e) => onChange({ ...s, tips: s.tips.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} />
              <button type="button" className="icon-btn" aria-label="Remove tip" onClick={() => onChange({ ...s, tips: s.tips.filter((_, j) => j !== i) })}>
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
          {s.tips.length < 6 ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange({ ...s, tips: [...s.tips, { title: "", body: "" }] })}>
              Add tip
            </button>
          ) : null}
          <div className="form-grid">
            <TextField label="Button label" value={s.cta?.label ?? ""} onChange={(e) => onChange({ ...s, cta: e.target.value ? { label: e.target.value, href: s.cta?.href ?? "/hair-care" } : null })} hint="Leave empty to hide." />
            <TextField label="Button link" value={s.cta?.href ?? ""} disabled={!s.cta} onChange={(e) => onChange({ ...s, cta: s.cta ? { ...s.cta, href: e.target.value } : null })} />
          </div>
        </div>
      );
    case "faq":
      return (
        <div className="astack">
          <TextField label="Heading" value={s.heading} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
          <SelectField label="Questions to show" value={String(s.limit)} onChange={(e) => onChange({ ...s, limit: Number(e.target.value) })}>
            {[3, 4, 5, 6, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </SelectField>
          <p className="small muted">Questions come from the FAQ page. Edit them in Pages.</p>
        </div>
      );
    case "newsletter":
      return (
        <div className="astack">
          <TextField label="Heading" value={s.heading} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
          <TextAreaField label="Supporting line" value={s.body} rows={2} onChange={(e) => onChange({ ...s, body: e.target.value })} />
        </div>
      );
  }
}

function sectionTitle(s: HomepageSection) {
  if ("heading" in s && s.heading) return s.heading;
  if (s.type === "marquee") return s.items.slice(0, 2).join(", ");
  if (s.type === "promises") return s.items.map((i) => i.title).join(", ");
  return "";
}

function StorefrontEditorPageInner() {
  const toast = useToast();
  const home = useResource(() => api().call("adminGetHomepage"));
  const collections = useResource(() => api().call("adminListCollections"));
  const [sections, setSections] = useState<HomepageSection[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addType, setAddType] = useState<HomepageSectionType>("product_rail");
  useUnsavedWarning(dirty);

  useEffect(() => {
    if (home.data) setSections(home.data.sections);
  }, [home.data]);

  const change = (next: HomepageSection[]) => {
    setSections(next);
    setDirty(true);
  };

  if (home.error) return <LoadError message={home.error} onRetry={home.reload} />;
  if (!sections) return <LoadingRows rows={8} />;

  const save = async () => {
    setSaving(true);
    try {
      const h = await api().call("adminUpdateHomepage", { body: { sections } });
      setSections(h.sections);
      setDirty(false);
      toast("Homepage saved. The store updates within a minute.");
    } catch (err) {
      toast(errorMessage(err), "danger");
    } finally {
      setSaving(false);
    }
  };

  const move = (i: number, d: -1 | 1) => {
    const next = [...sections];
    const [it] = next.splice(i, 1);
    next.splice(i + d, 0, it!);
    change(next);
  };

  return (
    <>
      <PageHeader
        title="Homepage"
        description={dirty ? "You have unsaved changes." : "Arrange, show, hide and edit the sections of your homepage."}
        actions={
          <>
            <a href="/" target="_blank" className="btn btn--ghost btn--sm">
              Preview store
            </a>
            <button type="button" className="btn" onClick={save} disabled={saving || !dirty}>
              {saving ? <span className="spinner" aria-hidden /> : null}
              Save changes
            </button>
          </>
        }
      />
      <div className="aeditor">
        <div className="aeditor__main">
          <Panel title="Homepage sections">
            <ol className="asections">
              {sections.map((s, i) => (
                <li key={s.id} className={`asection ${s.enabled ? "" : "is-off"}`}>
                  <div className="asection__head">
                    <div className="acoll__order">
                      <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move section up">
                        <Icon name="arrowUp" size={16} />
                      </button>
                      <button type="button" className="icon-btn" onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label="Move section down">
                        <Icon name="arrowDown" size={16} />
                      </button>
                    </div>
                    <button type="button" className="asection__title" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
                      <span className="badge">{typeLabel[s.type]}</span>
                      <span className="asection__label">{sectionTitle(s) || "Untitled"}</span>
                    </button>
                    <Switch checked={s.enabled} onChange={(v) => change(sections.map((x) => (x.id === s.id ? { ...x, enabled: v } : x)))} label={s.enabled ? "Shown" : "Hidden"} />
                    <button type="button" className="icon-btn" aria-label="Remove section" onClick={() => change(sections.filter((x) => x.id !== s.id))}>
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                  {open === s.id ? (
                    <div className="asection__body">
                      <SectionFields s={s} collections={collections.data ?? []} onChange={(next) => change(sections.map((x) => (x.id === s.id ? next : x)))} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
            <div className="cluster">
              <select className="select select--sm" value={addType} onChange={(e) => setAddType(e.target.value as HomepageSectionType)} aria-label="Section type">
                {(Object.keys(typeLabel) as HomepageSectionType[]).map((t) => (
                  <option key={t} value={t}>
                    {typeLabel[t]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  const s = newSection(addType);
                  change([...sections, s]);
                  setOpen(s.id);
                }}
              >
                Add section
              </button>
            </div>
          </Panel>
        </div>
        <aside className="aeditor__side">
          <Panel title="Tips">
            <ul className="astack small muted">
              <li>Sections show in this order on the homepage. Hidden sections keep their content.</li>
              <li>Product rows fill themselves from your catalog: featured, newest, best sellers or a collection.</li>
              <li>Edit the menu and footer links in Navigation.</li>
            </ul>
          </Panel>
        </aside>
      </div>
    </>
  );
}

export default function StorefrontEditorPage() {
  return (
    <RequirePermission permission="content:write">
      <StorefrontEditorPageInner />
    </RequirePermission>
  );
}
