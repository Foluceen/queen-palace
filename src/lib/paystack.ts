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
