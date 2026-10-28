/**
 * Post-login redirect targets come from the URL (?next=), so they are untrusted.
 * Only same-site paths under the allowed prefix are accepted; anything else falls back.
 */
export function safeNext(next: string | null | undefined, prefix: "/" | "/admin", fallback: string): string {
  if (!next) return fallback;
  let value: string;
  try {
    value = decodeURIComponent(next).trim();
  } catch {
    return fallback;
  }
  // Must be a plain absolute path: no scheme, no protocol-relative "//", no backslashes or control characters.
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value) || /^\/[^/]*:/.test(value)) return fallback;
  if (prefix === "/admin" && !(value === "/admin" || value.startsWith("/admin/") || value.startsWith("/admin?"))) return fallback;
  if (value.startsWith("/admin/login")) return fallback;
  return value;
}
