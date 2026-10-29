/** URL handle from any text: lower-case a–z, 0–9 and single hyphens (same rule as the mock backend). */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

/** The handle to send: the typed handle, or one made from the title when it's left empty. */
export const handleFor = (handle: string, title: string) => slugify(handle.trim() || title);
