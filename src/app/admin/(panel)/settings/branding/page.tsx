"use client";

import { useEffect, useState } from "react";
import { RequirePermission } from "@/components/admin/AdminSession";
import { useResource, useUnsavedWarning } from "@/components/admin/hooks";
import { ImageField } from "@/components/admin/MediaPicker";
import { useToast } from "@/components/admin/Toast";
import { LoadError, LoadingRows, MoneyInput, PageHeader, Panel, Switch } from "@/components/admin/ui";
import { TextField } from "@/components/ui/Field";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import type { BrandColors, StoreSettings } from "@/lib/types";

const colorFields: { key: keyof BrandColors; label: string; hint: string }[] = [
  { key: "background", label: "Background", hint: "The page colour. Keep it very dark for this design." },
  { key: "panel", label: "Panels", hint: "Cards, drawers and forms." },
  { key: "primary", label: "Primary", hint: "Main buttons like Add to bag." },
  { key: "highlight", label: "Highlight", hint: "Sale prices, stars and facts." },
  { key: "soft", label: "Soft tint", hint: "Links and gentle accents." },
];

const presets: { name: string; colors: BrandColors }[] = [
  { name: "Noir pink and gold", colors: { background: "#0B0709", panel: "#161015", primary: "#FF4F9A", highlight: "#D8B25A", soft: "#F6B3CF" } },
  { name: "Champagne night", colors: { background: "#0A0908", panel: "#16130F", primary: "#E9B872", highlight: "#F3D9A4", soft: "#F5C6D6" } },
  { name: "Berry velvet", colors: { background: "#0C0610", panel: "#1A0F1E", primary: "#E0457B", highlight: "#C9A14A", soft: "#E8A6C8" } },
];

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
      const { logo, ...rest } = s;
      const saved = await api().call("adminUpdateStoreSettings", { body: { ...rest, logoId: logo?.id ?? null } });
      setS(saved);
      setDirty(false);
      toast("Store details saved. The storefront updates within a minute.");
    } catch (err) {
      toast(errorMessage(err), "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Branding and details"
        description="Your name, colours, contact details and the announcement bar."
        actions={
          <button type="button" className="btn" onClick={save} disabled={saving || !dirty}>
            {saving ? <span className="spinner" aria-hidden /> : null}
            Save changes
          </button>
        }
      />
      <div className="aeditor">
        <div className="aeditor__main">
          <Panel title="Colours">
            <div className="abrand-preview" style={{ background: c.background, color: "#FBF2F6" }}>
              <div className="abrand-preview__card" style={{ background: c.panel }}>
                <p className="abrand-preview__title" style={{ backgroundImage: `linear-gradient(115deg, ${c.primary}, ${c.soft} 45%, ${c.highlight})` }}>
                  {s.name}
                </p>
                <p className="small" style={{ color: c.soft }}>
                  Double Drawn Bone Straight
                </p>
                <p style={{ color: c.highlight, fontWeight: 800 }}>From ₦165,000</p>
                <span className="abrand-preview__btn" style={{ background: c.primary }}>
                  Add to bag
                </span>
              </div>
            </div>
            <div className="cluster apresets">
              {presets.map((p) => (
                <button key={p.name} type="button" className="chip" onClick={() => set({ branding: { ...s.branding, colors: p.colors } })}>
                  <span className="apreset-dots" aria-hidden>
                    {Object.values(p.colors).map((hex) => (
                      <span key={hex} style={{ background: hex }} />
                    ))}
                  </span>
                  {p.name}
                </button>
              ))}
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
            <TextField
              label="Button roundness (px)"
              type="number"
              min={0}
              max={999}
              value={String(s.branding.radius)}
              onChange={(e) => set({ branding: { ...s.branding, radius: Math.max(0, Math.min(999, Number(e.target.value) || 0)) } })}
              hint="999 gives fully rounded pill buttons."
            />
          </Panel>
          <Panel title="Announcement bar">
            <div className="astack">
              <Switch checked={s.announcement.enabled} onChange={(v) => set({ announcement: { ...s.announcement, enabled: v } })} label="Show the announcement bar" />
              <TextField label="Message" value={s.announcement.message} onChange={(e) => set({ announcement: { ...s.announcement, message: e.target.value } })} />
              <TextField label="Link (optional)" value={s.announcement.href ?? ""} onChange={(e) => set({ announcement: { ...s.announcement, href: e.target.value || null } })} />
            </div>
          </Panel>
        </div>
        <aside className="aeditor__side">
          <Panel title="Store">
            <div className="astack">
              <TextField label="Store name" value={s.name} onChange={(e) => set({ name: e.target.value })} />
              <TextField label="Tagline" value={s.tagline} onChange={(e) => set({ tagline: e.target.value })} />
              <ImageField label="Logo (optional)" value={s.logo} onChange={(logo) => set({ logo })} />
              <p className="small muted">Without a logo, the store name is shown in the display font with the brand gradient.</p>
              <label className="field">
                <span className="field__label">Free delivery threshold</span>
                <MoneyInput value={s.freeShippingThreshold} onChange={(v) => set({ freeShippingThreshold: v })} placeholder="None" />
              </label>
            </div>
          </Panel>
          <Panel title="Contact">
            <div className="astack">
              <TextField label="Email" type="email" value={s.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} />
              <TextField label="Phone" value={s.phone} onChange={(e) => set({ phone: e.target.value })} />
              <TextField label="WhatsApp" value={s.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} hint="Used for the floating chat button." />
              <TextField label="Address" value={s.address} onChange={(e) => set({ address: e.target.value })} />
              <TextField label="Instagram URL" value={s.social.instagram ?? ""} onChange={(e) => set({ social: { ...s.social, instagram: e.target.value || null } })} />
              <TextField label="TikTok URL" value={s.social.tiktok ?? ""} onChange={(e) => set({ social: { ...s.social, tiktok: e.target.value || null } })} />
              <TextField label="Facebook URL" value={s.social.facebook ?? ""} onChange={(e) => set({ social: { ...s.social, facebook: e.target.value || null } })} />
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
