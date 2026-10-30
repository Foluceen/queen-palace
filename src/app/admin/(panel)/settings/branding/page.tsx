"use client";

import { DEFAULT_BRAND_COLORS } from "@/lib/brand";
import { useEffect, useState } from "react";
import { RequirePermission } from "@/components/admin/AdminSession";
import { useResource, useUnsavedWarning } from "@/components/admin/hooks";
import { ImageField } from "@/components/admin/MediaPicker";
import { useToast } from "@/components/admin/Toast";
import { LoadError, LoadingRows, MoneyInput, PageHeader, Panel, Switch } from "@/components/admin/ui";
import { Logo } from "@/components/brand/Logo";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import type { BrandColors, StoreSettings, ThemeMode } from "@/lib/types";

const DEFAULT_COLORS: BrandColors = DEFAULT_BRAND_COLORS;

const colorFields: { key: keyof BrandColors; label: string; hint: string }[] = [
  { key: "burgundy", label: "Hot pink", hint: "Buttons, highlights, prices and active states." },
  { key: "gold", label: "Soft pink", hint: "Italic headings, labels, hover states and star ratings." },
  { key: "lightBackground", label: "Light background", hint: "Warm ivory page colour." },
  { key: "lightSurface", label: "Light surface", hint: "Cards, drawers and panels in light mode." },
  { key: "darkBackground", label: "Dark background", hint: "Near-black page colour." },
  { key: "darkSurface", label: "Dark surface", hint: "Cards and panels in dark mode." },
];

/** Blank strings are sent as null so unknown contact details stay hidden on the storefront. */
const orNull = (v: string) => (v.trim() ? v : null);

function Preview({ s, dark }: { s: StoreSettings; dark: boolean }) {
  const c = s.branding.colors;
  const bg = dark ? c.darkBackground : c.lightBackground;
  const surface = dark ? c.darkSurface : c.lightSurface;
  const text = dark ? "#F6EFE4" : "#231D1F";
  const cta = dark ? "#F1C6D8" : "#24170F";
  return (
    <div className="abrand-preview" style={{ background: bg, color: text, ["--logo-mark" as string]: c.gold, ["--logo-text" as string]: dark ? "#F6ECE3" : "#1F1612" }}>
      <Logo variant="horizontal" className="abrand-preview__logo" title="" />
      <div className="abrand-preview__card" style={{ background: surface }}>
        <p className="small" style={{ opacity: 0.85 }}>
          Bone Straight
        </p>
        <p style={{ fontWeight: 700 }}>₦165,000</p>
        <span className="abrand-preview__btn" style={{ background: cta, color: dark ? "#1F1210" : "#FBF3EC", borderRadius: Math.min(s.branding.radius, 999) }}>
          Add to bag
        </span>
      </div>
      <span className="small" style={{ opacity: 0.85 }}>
        {dark ? "Dark mode" : "Light mode"}
      </span>
    </div>
  );
}

function BrandingPageInner() {
  const toast = useToast();
  const { data, error, reload } = useResource(() => api().call("adminGetStoreSettings"));
  const [s, setS] = useState<StoreSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  useUnsavedWarning(dirty);

  useEffect(() => {
    if (data) setS(data);
  }, [data]);

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!s) return <LoadingRows rows={8} />;

  const set = (patch: Partial<StoreSettings>) => {
    setS({ ...s, ...patch });
    setDirty(true);
  };
  const setColor = (k: keyof BrandColors, v: string) => set({ branding: { ...s.branding, colors: { ...s.branding.colors, [k]: v.toUpperCase() } } });
  const c = s.branding.colors;

  const save = async () => {
    setSaving(true);
    try {
      const { logo, logoDark, ...rest } = s;
      const saved = await api().call("adminUpdateStoreSettings", { body: { ...rest, logoId: logo?.id ?? null, logoDarkId: logoDark?.id ?? null } });
      setS(saved);
      setDirty(false);
      toast("Store settings saved. The storefront updates within a minute.");
    } catch (err) {
      toast(errorMessage(err), "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Shop details & colours"
        description="Your shop name, logo, colours and how customers can reach you."
        actions={
          <button type="button" className="btn" onClick={save} disabled={saving || !dirty}>
            {saving ? <span className="spinner" aria-hidden /> : null}
            Save changes
          </button>
        }
      />
      <div className="aeditor">
        <div className="aeditor__main">
          <Panel title="Colours and theme">
            <div className="abrand-previews">
              <Preview s={s} dark={false} />
              <Preview s={s} dark />
            </div>
            <div className="acolors">
              {colorFields.map((f) => (
                <label key={f.key} className="acolor-field">
                  <input type="color" className="acolor" value={c[f.key]} onChange={(e) => setColor(f.key, e.target.value)} />
                  <span>
                    <span className="field__label">{f.label}</span>
                    <span className="field__hint block">
                      {c[f.key]}. {f.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="aform-grid">
              <SelectField label="Admin default theme" value={s.theme.defaultMode} onChange={(e) => set({ theme: { defaultMode: e.target.value as ThemeMode } })} hint="The storefront is always black, pink and gold. This only sets the admin's default.">
                <option value="system">Match the visitor's device</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </SelectField>
              <TextField
                label="Button corner radius (px)"
                type="number"
                min={0}
                max={999}
                value={String(s.branding.radius)}
                onChange={(e) => set({ branding: { ...s.branding, radius: Math.max(0, Math.min(999, Number(e.target.value) || 0)) } })}
                hint="999 (pill buttons) is the house style. 0 gives square buttons."
              />
            </div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => set({ branding: { ...s.branding, colors: DEFAULT_COLORS, radius: 999 } })}>
              Restore Queen Luxury Hair colours
            </button>
          </Panel>

          <Panel title="Announcement bar">
            <div className="astack">
              <Switch checked={s.announcement.enabled} onChange={(v) => set({ announcement: { ...s.announcement, enabled: v } })} label="Show the announcement bar" />
              <TextField label="Message" value={s.announcement.message} onChange={(e) => set({ announcement: { ...s.announcement, message: e.target.value } })} />
              <TextField label="Link (optional)" value={s.announcement.href ?? ""} onChange={(e) => set({ announcement: { ...s.announcement, href: e.target.value || null } })} placeholder="/collections/bone-straight" />
            </div>
          </Panel>

          <Panel title="Product page notes">
            <div className="astack">
              <TextAreaField label="Delivery note" rows={3} value={s.productPageNotes.shipping} onChange={(e) => set({ productPageNotes: { ...s.productPageNotes, shipping: e.target.value } })} hint="Shown under Add to bag on every product. Leave empty to hide." />
              <TextAreaField label="Returns note" rows={3} value={s.productPageNotes.returns} onChange={(e) => set({ productPageNotes: { ...s.productPageNotes, returns: e.target.value } })} hint="Links to your returns policy page." />
            </div>
          </Panel>
        </div>

        <aside className="aeditor__side">
          <Panel title="Store">
            <div className="astack">
              <TextField label="Store name" value={s.name} onChange={(e) => set({ name: e.target.value })} />
              <TextField label="Tagline" value={s.tagline} onChange={(e) => set({ tagline: e.target.value })} />
              <TextAreaField label="Search engine description" rows={3} maxLength={170} value={s.metaDescription} onChange={(e) => set({ metaDescription: e.target.value })} hint={`${s.metaDescription.length}/160 characters recommended.`} />
              <ImageField label="Uploaded logo for light mode (optional)" value={s.logo} onChange={(logo) => set({ logo })} />
              <ImageField label="Uploaded logo for dark mode (optional)" value={s.logoDark} onChange={(logoDark) => set({ logoDark })} />
              <p className="small muted">Without uploads, the built-in crown logo is used. It adapts to light and dark mode automatically.</p>
              <label className="field">
                <span className="field__label">Free delivery when the order is over</span>
                <MoneyInput value={s.freeShippingThreshold} onChange={(v) => set({ freeShippingThreshold: v })} placeholder="None" />
              </label>
            </div>
          </Panel>
          <Panel title="Contact details">
            <div className="astack">
              <p className="small muted">Leave anything you don't want shown empty. Empty details are hidden on the storefront.</p>
              <TextField label="Store address" value={s.address} onChange={(e) => set({ address: e.target.value })} />
              <TextField label="Opening hours" value={s.openingHours ?? ""} onChange={(e) => set({ openingHours: orNull(e.target.value) })} placeholder="e.g. Monday to Saturday, 9am to 7pm" />
              <TextField label="WhatsApp number" inputMode="tel" value={s.whatsapp ?? ""} onChange={(e) => set({ whatsapp: orNull(e.target.value) })} placeholder="+234…" hint="International format. Turns on WhatsApp buttons across the store." />
              <TextField label="Phone" inputMode="tel" value={s.phone ?? ""} onChange={(e) => set({ phone: orNull(e.target.value) })} />
              <TextField label="Email" type="email" value={s.contactEmail ?? ""} onChange={(e) => set({ contactEmail: orNull(e.target.value) })} />
              <TextField label="Instagram URL" value={s.social.instagram ?? ""} onChange={(e) => set({ social: { ...s.social, instagram: orNull(e.target.value) } })} />
              <TextField label="TikTok URL" value={s.social.tiktok ?? ""} onChange={(e) => set({ social: { ...s.social, tiktok: orNull(e.target.value) } })} />
              <TextField label="Facebook URL" value={s.social.facebook ?? ""} onChange={(e) => set({ social: { ...s.social, facebook: orNull(e.target.value) } })} />
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}

export default function BrandingPage() {
  return (
    <RequirePermission permission="settings:write">
      <BrandingPageInner />
    </RequirePermission>
  );
}
