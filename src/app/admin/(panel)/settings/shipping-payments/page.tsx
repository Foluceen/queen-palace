"use client";

import { useEffect, useState } from "react";
import { RequirePermission } from "@/components/admin/AdminSession";
import { useResource, useUnsavedWarning } from "@/components/admin/hooks";
import { useToast } from "@/components/admin/Toast";
import { LoadError, LoadingRows, MoneyInput, PageHeader, Panel, Switch } from "@/components/admin/ui";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import { NIGERIAN_STATES, type PaymentSettings, type ShippingSettings, type ShippingZone } from "@/lib/types";

const rid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

function StatePicker({ value, onChange, taken }: { value: string[]; onChange(v: string[]): void; taken: string[] }) {
  return (
    <details className="astates">
      <summary className="small">{value.length ? value.join(", ") : "Every state not covered by another zone"}</summary>
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

function ShippingPaymentsPageInner() {
  const toast = useToast();
  const shipping = useResource(() => api().call("adminGetShippingSettings"));
  const payments = useResource(() => api().call("adminGetPaymentSettings"));
  const [ship, setShip] = useState<ShippingSettings | null>(null);
  const [pay, setPay] = useState<PaymentSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  useUnsavedWarning(dirty);

  useEffect(() => {
    if (shipping.data) setShip(shipping.data);
  }, [shipping.data]);
  useEffect(() => {
    if (payments.data) setPay(payments.data);
  }, [payments.data]);

  if (shipping.error || payments.error) return <LoadError message={(shipping.error ?? payments.error)!} onRetry={() => (void shipping.reload(), void payments.reload())} />;
  if (!ship || !pay) return <LoadingRows rows={8} />;

  const setZone = (i: number, z: ShippingZone) => {
    setShip({ ...ship, zones: ship.zones.map((x, j) => (j === i ? z : x)) });
    setDirty(true);
  };
  const setP = (next: PaymentSettings) => {
    setPay(next);
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const [s, p] = await Promise.all([api().call("adminUpdateShippingSettings", { body: ship }), api().call("adminUpdatePaymentSettings", { body: pay })]);
      setShip(s);
      setPay(p);
      setDirty(false);
      toast("Shipping and payment settings saved");
    } catch (err) {
      toast(errorMessage(err), "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Shipping and payments"
        description="Delivery fees are calculated by the backend from these zones. Secret payment keys stay on the server and never appear here."
        actions={
          <button type="button" className="btn" onClick={save} disabled={saving || !dirty}>
            {saving ? <span className="spinner" aria-hidden /> : null}
            Save changes
          </button>
        }
      />
      <div className="aeditor">
        <div className="aeditor__main">
          <Panel
            title="Delivery zones"
            actions={
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setShip({ ...ship, zones: [...ship.zones, { id: rid("zone"), name: "New zone", states: [], cities: [], rates: [{ id: rid("rate"), label: "Courier", description: "", amount: 0, etaDays: [2, 4], freeOver: null }] }] });
                  setDirty(true);
                }}
              >
                Add zone
              </button>
            }
          >
            <div className="astack">
              {ship.zones.map((z, i) => (
                <div key={z.id} className="azone">
                  <div className="aoption-row">
                    <TextField label="Zone name" value={z.name} onChange={(e) => setZone(i, { ...z, name: e.target.value })} />
                    <div className="field">
                      <span className="field__label">States</span>
                      <StatePicker value={z.states} taken={z.cities.length ? [] : ship.zones.filter((x) => x.id !== z.id && !x.cities.length).flatMap((x) => x.states)} onChange={(states) => setZone(i, { ...z, states })} />
                    </div>
                    <TextField
                      label="Only these towns (optional)"
                      value={z.cities.join(", ")}
                      onChange={(e) => setZone(i, { ...z, cities: e.target.value.split(",").map((c) => c.trimStart()).filter((c, k, arr) => c || k === arr.length - 1) })}
                      onBlur={() => setZone(i, { ...z, cities: z.cities.map((c) => c.trim()).filter(Boolean) })}
                      placeholder="Ilesha, Ijebu-Jesa"
                      hint="Comma separated. A town zone is used before the state-wide zone."
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Remove ${z.name}`}
                      onClick={() => {
                        setShip({ ...ship, zones: ship.zones.filter((_, j) => j !== i) });
                        setDirty(true);
                      }}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                  <div className="atable-wrap">
                    <table className="atable atable--edit">
                      <thead>
                        <tr>
                          <th scope="col">Option</th>
                          <th scope="col">Fee</th>
                          <th scope="col">Free over</th>
                          <th scope="col">Days</th>
                          <th scope="col">
                            <span className="sr-only">Remove</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {z.rates.map((r, k) => {
                          const setRate = (patch: Partial<typeof r>) => setZone(i, { ...z, rates: z.rates.map((x, m) => (m === k ? { ...x, ...patch } : x)) });
                          return (
                            <tr key={r.id}>
                              <td>
                                <input className="input input--sm" value={r.label} onChange={(e) => setRate({ label: e.target.value })} aria-label="Option name" />
                                <input className="input input--sm" value={r.description} onChange={(e) => setRate({ description: e.target.value })} aria-label="Description shown at checkout" placeholder="Shown at checkout" />
                              </td>
                              <td>
                                <MoneyInput value={r.amount} onChange={(v) => setRate({ amount: v ?? 0 })} ariaLabel="Fee" />
                              </td>
                              <td>
                                <MoneyInput value={r.freeOver} onChange={(v) => setRate({ freeOver: v })} ariaLabel="Free over" placeholder="Never" />
                              </td>
                              <td className="adays">
                                <input className="input input--sm" type="number" min={0} value={r.etaDays[0]} onChange={(e) => setRate({ etaDays: [Number(e.target.value), r.etaDays[1]] })} aria-label="Minimum days" />
                                <span aria-hidden>–</span>
                                <input className="input input--sm" type="number" min={0} value={r.etaDays[1]} onChange={(e) => setRate({ etaDays: [r.etaDays[0], Number(e.target.value)] })} aria-label="Maximum days" />
                              </td>
                              <td>
                                <button type="button" className="icon-btn" aria-label="Remove option" onClick={() => setZone(i, { ...z, rates: z.rates.filter((_, m) => m !== k) })}>
                                  <Icon name="trash" size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button type="button" className="link-btn small" onClick={() => setZone(i, { ...z, rates: [...z.rates, { id: rid("rate"), label: "", description: "", amount: 0, etaDays: [1, 3], freeOver: null }] })}>
                    Add delivery option
                  </button>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <aside className="aeditor__side">
          <Panel title="Card payments">
            <div className="astack">
              {(["paystack", "flutterwave"] as const).map((k) => (
                <div key={k} className="astack aprovider">
                  <Switch checked={pay[k].enabled} onChange={(v) => setP({ ...pay, [k]: { ...pay[k], enabled: v } })} label={k === "paystack" ? "Paystack" : "Flutterwave"} />
                  {pay[k].enabled ? (
                    <>
                      <SelectField label="Mode" value={pay[k].mode} onChange={(e) => setP({ ...pay, [k]: { ...pay[k], mode: e.target.value as "test" | "live" } })}>
                        <option value="test">Test</option>
                        <option value="live">Live</option>
                      </SelectField>
                      <TextField label="Public key" value={pay[k].publicKey} onChange={(e) => setP({ ...pay, [k]: { ...pay[k], publicKey: e.target.value } })} hint="Public key only. Add the secret key in the backend environment." />
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Bank transfer">
            <div className="astack">
              <Switch checked={pay.bankTransfer.enabled} onChange={(v) => setP({ ...pay, bankTransfer: { ...pay.bankTransfer, enabled: v } })} label="Accept bank transfers" />
              <TextField label="Bank" value={pay.bankTransfer.bankName} onChange={(e) => setP({ ...pay, bankTransfer: { ...pay.bankTransfer, bankName: e.target.value } })} />
              <TextField label="Account name" value={pay.bankTransfer.accountName} onChange={(e) => setP({ ...pay, bankTransfer: { ...pay.bankTransfer, accountName: e.target.value } })} />
              <TextField label="Account number" inputMode="numeric" value={pay.bankTransfer.accountNumber} onChange={(e) => setP({ ...pay, bankTransfer: { ...pay.bankTransfer, accountNumber: e.target.value } })} />
              <TextField label="Hold items for (hours)" type="number" min={1} value={String(pay.bankTransfer.holdHours)} onChange={(e) => setP({ ...pay, bankTransfer: { ...pay.bankTransfer, holdHours: Number(e.target.value) || 24 } })} />
              <TextAreaField label="Instructions" value={pay.bankTransfer.instructions} onChange={(e) => setP({ ...pay, bankTransfer: { ...pay.bankTransfer, instructions: e.target.value } })} rows={3} />
            </div>
          </Panel>
          <Panel title="Pay on delivery">
            <div className="astack">
              <Switch checked={pay.payOnDelivery.enabled} onChange={(v) => setP({ ...pay, payOnDelivery: { ...pay.payOnDelivery, enabled: v } })} label="Offer pay on delivery" />
              <div className="field">
                <span className="field__label">States</span>
                <StatePicker value={pay.payOnDelivery.states} taken={[]} onChange={(states) => setP({ ...pay, payOnDelivery: { ...pay.payOnDelivery, states } })} />
              </div>
              <label className="field">
                <span className="field__label">Maximum order total</span>
                <MoneyInput value={pay.payOnDelivery.maxOrderTotal} onChange={(v) => setP({ ...pay, payOnDelivery: { ...pay.payOnDelivery, maxOrderTotal: v } })} placeholder="No limit" />
              </label>
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}

export default function ShippingPaymentsPage() {
  return (
    <RequirePermission permission="settings:write">
      <ShippingPaymentsPageInner />
    </RequirePermission>
  );
}
