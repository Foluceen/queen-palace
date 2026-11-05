"use client";

import { useEffect, useState } from "react";
import { RequirePermission } from "@/components/admin/AdminSession";
import { useResource, useUnsavedWarning } from "@/components/admin/hooks";
import { useToast } from "@/components/admin/Toast";
import { LoadError, LoadingRows, PageHeader, Panel, Switch } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import { normalizePaymentSettings, paystackKeyProblem, paystackOnlySettings } from "@/lib/paystack";
import { DELIVERY_SUMMARY } from "@/lib/delivery";
import type { PaymentSettings } from "@/lib/types";

/* ------------------------------------------------------------------ payment */

function PaystackSettings() {
  const toast = useToast();
  const { data, error, reload } = useResource(async () => normalizePaymentSettings(await api().call("adminGetPaymentSettings")));
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
      const body = paystackOnlySettings(pay);
      const next = normalizePaymentSettings(await api().call("adminUpdatePaymentSettings", { body }));
      // If the server's reply leaves the key out, keep what was just saved on screen.
      setPay(next.paystack.publicKey || !body.paystack.publicKey ? next : { ...next, paystack: body.paystack });
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

/** Delivery isn't priced on the site: the driver is paid directly on arrival. */
function DeliveryInfo() {
  return (
    <Panel title="Delivery">
      <p>{DELIVERY_SUMMARY}</p>
      <p className="small muted">Customers only give their address, phone number and email at checkout. There are no delivery fees to set here. To change how delivery works, ask your developer.</p>
    </Panel>
  );
}

export default function ShippingPaymentsPage() {
  return (
    <RequirePermission permission="settings:write">
      <PageHeader title="Delivery & payment" description="How customers pay you, and how delivery works." />
      <div className="asettings">
        <PaystackSettings />
        <DeliveryInfo />
      </div>
    </RequirePermission>
  );
}
