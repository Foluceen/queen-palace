"use client";

import { useEffect, useState } from "react";
import { RequirePermission } from "@/components/admin/AdminSession";
import { useResource, useUnsavedWarning } from "@/components/admin/hooks";
import { useToast } from "@/components/admin/Toast";
import { LoadError, LoadingRows, MoneyInput, PageHeader, Panel, Switch } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import { paystackKeyProblem } from "@/lib/paystack";
import { NIGERIAN_STATES, type PaymentSettings, type ShippingSettings, type ShippingZone } from "@/lib/types";

type ZoneRate = ShippingZone["rates"][number];

const rid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

/* ------------------------------------------------------------------ payment */

function PaystackSettings() {
  const toast = useToast();
  const { data, error, reload } = useResource(() => api().call("adminGetPaymentSettings"));
  const [pay, setPay] = useState<PaymentSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  useUnsavedWarning(dirty);

  useEffect(() => {
    if (data) setPay(data);
  }, [data]);

  if (error) {
    return (
      <Panel title="Getting paid">
        <LoadError message={`Your payment settings couldn't be loaded: ${error}`} onRetry={reload} />
      </Panel>
    );
  }
  if (!pay) return <LoadingRows rows={3} />;

  const ps = pay.paystack;
  const problem = paystackKeyProblem(ps.publicKey, ps.mode, ps.enabled);
  const set = (patch: Partial<PaymentSettings["paystack"]>) => {
    setPay({ ...pay, paystack: { ...ps, ...patch } });
    setDirty(true);
  };

  const save = async () => {
    setTried(true);
    if (problem) return;
    setSaving(true);
    try {
      // Paystack is the only way the shop takes money: every other option is switched off.
      const next = await api().call("adminUpdatePaymentSettings", {
        body: {
          ...pay,
          paystack: { ...ps, publicKey: ps.publicKey.trim() },
          flutterwave: { ...pay.flutterwave, enabled: false },
          bankTransfer: { ...pay.bankTransfer, enabled: false },
          payOnDelivery: { ...pay.payOnDelivery, enabled: false },
        },
      });
      setPay(next);
      setDirty(false);
      setTried(false);
      toast("Payment settings saved");
    } catch (err) {
      toast(`Payment settings weren't saved: ${errorMessage(err)}`, "danger");
    } finally {
      setSaving(false);
    }
  };

  const others = [pay.flutterwave.enabled && "Flutterwave", pay.bankTransfer.enabled && "bank transfer", pay.payOnDelivery.enabled && "pay on delivery"].filter(Boolean) as string[];

  return (
    <Panel title="Getting paid">
      <div className="apay">
        <div className="apay__intro">
          <span className="apay__logo" aria-hidden>
            <Icon name="lock" size={20} />
          </span>
          <p>
            Customers pay with <strong>card, bank transfer or USSD</strong> on Paystack&apos;s secure page. The money goes into your Paystack account, and Paystack sends it to your bank.
          </p>
        </div>

        {others.length ? (
          <p className="notice notice--warning small">
            <span>
              The store still has {others.join(" and ")} switched on. Press <strong>Save payment settings</strong> to switch {others.length > 1 ? "them" : "it"} off so Paystack is the only way to pay.
            </span>
          </p>
        ) : null}

        <Switch checked={ps.enabled} onChange={(v) => set({ enabled: v })} label="Take payments with Paystack" />

        <fieldset className="apay__mode">
          <legend className="field__label">Are you ready to take real money?</legend>
          <label className={`apay__choice ${ps.mode === "test" ? "is-on" : ""}`}>
            <input type="radio" name="paystack-mode" checked={ps.mode === "test"} onChange={() => set({ mode: "test" })} />
            <span>
              <strong>Not yet, I&apos;m testing</strong>
              <span className="small muted">No real money moves. Use Paystack&apos;s test cards.</span>
            </span>
          </label>
          <label className={`apay__choice ${ps.mode === "live" ? "is-on" : ""}`}>
            <input type="radio" name="paystack-mode" checked={ps.mode === "live"} onChange={() => set({ mode: "live" })} />
            <span>
              <strong>Yes, go live</strong>
              <span className="small muted">Customers are charged for real.</span>
            </span>
          </label>
        </fieldset>

        <label className="field">
          <span className="field__label">Paystack public key</span>
          <input
            className={`input mono ${tried && problem ? "is-invalid" : ""}`}
            value={ps.publicKey}
            onChange={(e) => set({ publicKey: e.target.value })}
            placeholder={ps.mode === "live" ? "pk_live_…" : "pk_test_…"}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!(tried && problem)}
          />
          {problem && (tried || /^sk_/i.test(ps.publicKey.trim())) ? (
            <span className="field__error" role="alert">
              {problem}
            </span>
          ) : (
            <span className="field__hint">
              In Paystack go to <strong>Settings → API Keys &amp; Webhooks</strong> and copy the <strong>Public key</strong>. Never paste the Secret key anywhere on this site.
            </span>
          )}
        </label>

        <details className="amore apay__how">
          <summary>What else does Paystack need?</summary>
          <ol className="apay__steps">
            <li>A Paystack business account that has been approved for live payments (Paystack asks for your business and bank details).</li>
            <li>Your <strong>Secret key</strong> goes to the person who looks after the store&apos;s server, never into this page.</li>
            <li>That person also adds the store&apos;s payment notification address in Paystack (Settings → API Keys &amp; Webhooks), so orders are marked paid automatically.</li>
          </ol>
        </details>

        <div className="apay__actions">
          <button type="button" className="btn" onClick={save} disabled={saving || (!dirty && !others.length)}>
            {saving ? <span className="spinner" aria-hidden /> : null}
            Save payment settings
          </button>
        </div>
      </div>
    </Panel>
  );
}

/* ----------------------------------------------------------------- delivery */

function StatePicker({ value, onChange, taken }: { value: string[]; onChange(v: string[]): void; taken: string[] }) {
  return (
    <details className="astates">
      <summary>{value.length ? `${value.length} ${value.length === 1 ? "state" : "states"}: ${value.join(", ")}` : "Every state not in another area"}</summary>
      <ul className="achecks achecks--grid">
        {NIGERIAN_STATES.map((s) => {
          const other = taken.includes(s) && !value.includes(s);
          return (
            <li key={s}>
              <label className={`checkbox ${other ? "muted" : ""}`}>
                <input type="checkbox" checked={value.includes(s)} disabled={other} onChange={(e) => onChange(e.target.checked ? [...value, s] : value.filter((x) => x !== s))} />
                {s}
              </label>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function RateCard({ rate, onChange, onRemove }: { rate: ZoneRate; onChange(patch: Partial<ZoneRate>): void; onRemove(): void }) {
  return (
    <li className="arate">
      <div className="arate__grid">
        <label className="field">
          <span className="field__label">Name</span>
          <input className="input" value={rate.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="e.g. Rider delivery" />
        </label>
        <label className="field">
          <span className="field__label">Price</span>
          <MoneyInput value={rate.amount} onChange={(v) => onChange({ amount: v ?? 0 })} ariaLabel="Price" />
        </label>
        <label className="field">
          <span className="field__label">Free if the order is over</span>
          <MoneyInput value={rate.freeOver} onChange={(v) => onChange({ freeOver: v })} ariaLabel="Free if the order is over" placeholder="Never free" />
        </label>
        <div className="field">
          <span className="field__label">Arrives in</span>
          <span className="arate__days">
            <input className="input" type="number" min={0} value={rate.etaDays[0]} onChange={(e) => onChange({ etaDays: [Number(e.target.value), rate.etaDays[1]] })} aria-label="Fewest days" />
            <span>to</span>
            <input className="input" type="number" min={0} value={rate.etaDays[1]} onChange={(e) => onChange({ etaDays: [rate.etaDays[0], Number(e.target.value)] })} aria-label="Most days" />
            <span>days</span>
          </span>
        </div>
        <label className="field arate__wide">
          <span className="field__label">Short note for customers (optional)</span>
          <input className="input" value={rate.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="e.g. We call before we come." />
        </label>
      </div>
      <button type="button" className="link-btn small arate__remove" onClick={onRemove}>
        <Icon name="trash" size={14} /> Remove this option
      </button>
    </li>
  );
}

function DeliverySettings() {
  const toast = useToast();
  const { data, error, reload } = useResource(() => api().call("adminGetShippingSettings"));
  const [ship, setShip] = useState<ShippingSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  useUnsavedWarning(dirty);

  useEffect(() => {
    if (data) setShip(data);
  }, [data]);

  if (error) return <LoadError message={`Your delivery settings couldn't be loaded: ${error}`} onRetry={reload} />;
  if (!ship) return <LoadingRows rows={4} />;

  const setZone = (i: number, z: ShippingZone) => {
    setShip({ ...ship, zones: ship.zones.map((x, j) => (j === i ? z : x)) });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      setShip(await api().call("adminUpdateShippingSettings", { body: ship }));
      setDirty(false);
      toast("Delivery prices saved");
    } catch (err) {
      toast(`Delivery prices weren't saved: ${errorMessage(err)}`, "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Delivery prices">
      <p className="small muted">Group states into areas, then say how you deliver to each area and what it costs. Customers only see the options for their state.</p>
      <div className="astack">
        {ship.zones.map((z, i) => (
          <div key={z.id} className="azone">
            <div className="azone__head">
              <label className="field azone__name">
                <span className="field__label">Area name</span>
                <input className="input" value={z.name} onChange={(e) => setZone(i, { ...z, name: e.target.value })} placeholder="e.g. Osun State" />
              </label>
              <button
                type="button"
                className="link-btn small"
                onClick={() => {
                  setShip({ ...ship, zones: ship.zones.filter((_, j) => j !== i) });
                  setDirty(true);
                }}
              >
                Remove area
              </button>
            </div>
            <div className="field">
              <span className="field__label">Which states?</span>
              <StatePicker value={z.states} taken={z.cities.length ? [] : ship.zones.filter((x) => x.id !== z.id && !x.cities.length).flatMap((x) => x.states)} onChange={(states) => setZone(i, { ...z, states })} />
            </div>
            <label className="field">
              <span className="field__label">Only these towns (optional)</span>
              <input
                className="input"
                value={z.cities.join(", ")}
                onChange={(e) => setZone(i, { ...z, cities: e.target.value.split(",").map((c) => c.trimStart()).filter((c, k, arr) => c || k === arr.length - 1) })}
                onBlur={() => setZone(i, { ...z, cities: z.cities.map((c) => c.trim()).filter(Boolean) })}
                placeholder="e.g. Ilesha, Ijebu-Jesa"
              />
              <span className="field__hint">Leave empty for the whole state. Separate towns with commas.</span>
            </label>
            <p className="azone__sub">How you deliver here</p>
            <ul className="arates">
              {z.rates.map((r, k) => (
                <RateCard
                  key={r.id}
                  rate={r}
                  onChange={(patch) => setZone(i, { ...z, rates: z.rates.map((x, m) => (m === k ? { ...x, ...patch } : x)) })}
                  onRemove={() => setZone(i, { ...z, rates: z.rates.filter((_, m) => m !== k) })}
                />
              ))}
            </ul>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setZone(i, { ...z, rates: [...z.rates, { id: rid("rate"), label: "", description: "", amount: 0, etaDays: [1, 3], freeOver: null }] })}>
              <Icon name="plus" size={16} /> Add a way to deliver
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setShip({ ...ship, zones: [...ship.zones, { id: rid("zone"), name: "", states: [], cities: [], rates: [{ id: rid("rate"), label: "Rider delivery", description: "", amount: 0, etaDays: [2, 4], freeOver: null }] }] });
            setDirty(true);
          }}
        >
          <Icon name="plus" size={16} /> Add an area
        </button>
      </div>
      <div className="apay__actions">
        <button type="button" className="btn" onClick={save} disabled={saving || !dirty}>
          {saving ? <span className="spinner" aria-hidden /> : null}
          Save delivery prices
        </button>
      </div>
    </Panel>
  );
}

export default function ShippingPaymentsPage() {
  return (
    <RequirePermission permission="settings:write">
      <PageHeader title="Delivery & payment" description="How customers pay you, and what delivery costs." />
      <div className="asettings">
        <PaystackSettings />
        <DeliverySettings />
      </div>
    </RequirePermission>
  );
}
