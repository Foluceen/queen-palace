/**
 * Paystack is the store's only payment provider. The browser only ever handles the PUBLIC key;
 * the secret key lives in the backend environment and is used for initialize/verify/webhooks.
 */

/** Checks the Paystack public key the owner pasted. Returns a plain-English problem, or null. */
export function paystackKeyProblem(key: string, mode: "test" | "live", enabled: boolean): string | null {
  const k = key.trim();
  if (/^sk_/i.test(k)) return "That is your SECRET key. Never paste it here or share it with anyone. Delete it from this box and copy the PUBLIC key instead (it starts with pk_).";
  if (!enabled && !k) return null;
  if (!k) return "Paste your Paystack public key.";
  if (!/^pk_(test|live)_[A-Za-z0-9]+$/.test(k)) return "This doesn't look like a Paystack public key. It should start with pk_live_ or pk_test_.";
  if (mode === "live" && k.startsWith("pk_test_")) return "You chose Live, but this is a test key (pk_test_). Use the key that starts with pk_live_.";
  if (mode === "test" && k.startsWith("pk_live_")) return "You chose Testing, but this is a live key (pk_live_). Use the key that starts with pk_test_.";
  return null;
}

type Settings = import("./types").PaymentSettings;

/**
 * Fills in anything the backend's payment settings leave out, so the admin page never breaks on
 * a partial response. Only known fields are kept (nothing else is sent back on save).
 */
export function normalizePaymentSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, Record<string, unknown> | undefined>;
  const provider = (p: Record<string, unknown> | undefined) => ({
    enabled: p?.enabled === true,
    mode: p?.mode === "live" ? ("live" as const) : ("test" as const),
    publicKey: typeof p?.publicKey === "string" ? p.publicKey : "",
  });
  const bt = r.bankTransfer ?? {};
  const pod = r.payOnDelivery ?? {};
  return {
    paystack: provider(r.paystack),
    flutterwave: provider(r.flutterwave),
    bankTransfer: {
      enabled: bt.enabled === true,
      bankName: String(bt.bankName ?? ""),
      accountName: String(bt.accountName ?? ""),
      accountNumber: String(bt.accountNumber ?? ""),
      instructions: String(bt.instructions ?? ""),
      holdHours: typeof bt.holdHours === "number" ? bt.holdHours : 48,
    },
    payOnDelivery: {
      enabled: pod.enabled === true,
      states: Array.isArray(pod.states) ? pod.states.filter((s): s is string => typeof s === "string") : [],
      maxOrderTotal: typeof pod.maxOrderTotal === "number" ? pod.maxOrderTotal : null,
    },
  };
}

/** The body sent on save: Paystack as chosen, every other method off. Public key only. */
export function paystackOnlySettings(s: Settings): Settings {
  return {
    ...s,
    paystack: { enabled: s.paystack.enabled, mode: s.paystack.mode, publicKey: s.paystack.publicKey.trim() },
    flutterwave: { ...s.flutterwave, enabled: false },
    bankTransfer: { ...s.bankTransfer, enabled: false },
    payOnDelivery: { ...s.payOnDelivery, enabled: false },
  };
}
