/**
 * Theme preference: "light" | "dark" | "system". Stored per browser in localStorage
 * (key below) and resolved to data-theme="light" | "dark" on <html> before first paint.
 */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "qp-theme";
export const THEME_EVENT = "qp-theme-change";

export function isThemePreference(v: unknown): v is ThemePreference {
  return v === "light" || v === "dark" || v === "system";
}

/**
 * Inline pre-paint script. `fallback` is the store's default from admin → Branding.
 * Kept tiny and dependency-free; mirrors readPreference/resolve below.
 */
export function themeScript(input: ThemePreference | string | null | undefined): string {
  // The value comes from the store API and is written into an inline script: accept only known values.
  const fallback: ThemePreference = isThemePreference(input) ? input : "system";
  // The storefront is always dark (black, pink, gold). Only /admin honours light/system.
  return `(function(){var d=document.documentElement,k=${JSON.stringify(THEME_STORAGE_KEY)},f=${JSON.stringify(fallback)},p=f;try{var s=localStorage.getItem(k);if(s==="light"||s==="dark"||s==="system")p=s}catch(e){}if(location.pathname.indexOf("/admin")!==0){p="dark";f="dark"}var m=window.matchMedia&&matchMedia("(prefers-color-scheme: dark)");function a(){var r=p==="system"?(m&&m.matches?"dark":"light"):p;d.dataset.theme=r;d.dataset.themePref=p;d.style.colorScheme=r}a();d.dataset.themeDefault=f;if(m&&m.addEventListener)m.addEventListener("change",function(){if(d.dataset.themePref==="system"){p="system";a()}})})();`;
}

export function readPreference(): ThemePreference {
  const root = document.documentElement;
  const fromDom = root.dataset.themePref;
  if (isThemePreference(fromDom)) return fromDom;
  return isThemePreference(root.dataset.themeDefault) ? root.dataset.themeDefault : "system";
}

export function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref !== "system") return pref;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Applies and persists a preference, cross-fading where the browser supports it. */
export function applyPreference(pref: ThemePreference) {
  const root = document.documentElement;
  const set = () => {
    const r = resolve(pref);
    root.dataset.theme = r;
    root.dataset.themePref = pref;
    root.style.colorScheme = r;
  };
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* storage unavailable: preference lasts for this page only */
  }
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !reduce) doc.startViewTransition(set);
  else set();
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: pref }));
}
