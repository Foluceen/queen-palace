/**
 * Nigerian mobile numbers: 0803 123 4567, +234 803 123 4567 or 2348031234567.
 * Network prefixes are 070x, 080x, 081x, 090x and 091x. Spaces, dashes and brackets are ignored.
 * The backend validates again; this only gives shoppers instant feedback.
 */
const NG_MOBILE = /^(?:\+?234|0)[789][01]\d{8}$/;

export function isNigerianPhone(raw: string): boolean {
  return NG_MOBILE.test(raw.replace(/[\s\-().]/g, ""));
}

/** Normalises to +234XXXXXXXXXX, or returns null when the number isn't valid. */
export function normalizeNigerianPhone(raw: string): string | null {
  const s = raw.replace(/[\s\-().]/g, "");
  if (!NG_MOBILE.test(s)) return null;
  return `+234${s.replace(/^\+?234|^0/, "")}`;
}

export const PHONE_HINT = "A Nigerian mobile number, e.g. 0803 123 4567.";
export const PHONE_ERROR = "Enter a Nigerian mobile number, e.g. 0803 123 4567.";
