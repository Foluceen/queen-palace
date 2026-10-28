/** Stand-in for next/navigation in the preview bundle. */
import { createContext, useContext, useMemo } from "react";
import { getLoc, navigate, refresh, useLoc } from "../router";

export class NotFoundError extends Error {
  readonly digest = "NEXT_NOT_FOUND";
}

export function notFound(): never {
  throw new NotFoundError("Not found");
}

export function redirect(path: string): never {
  navigate(path, { replace: true });
  throw new Error("redirect");
}

export function useRouter() {
  return useMemo(
    () => ({
      push: (href: string, o?: { scroll?: boolean }) => navigate(href, o),
      replace: (href: string, o?: { scroll?: boolean }) => navigate(href, { ...o, replace: true }),
      back: () => history.back(),
      forward: () => history.forward(),
      refresh,
      prefetch: () => {},
    }),
    [],
  );
}

export function usePathname() {
  return useLoc().path;
}

export function useSearchParams() {
  const { query } = useLoc();
  return useMemo(() => new URLSearchParams(query), [query]);
}

export const ParamsContext = createContext<Record<string, string>>({});
export function useParams<T extends Record<string, string>>() {
  return useContext(ParamsContext) as T;
}

export { getLoc };

/** The preview has no Next control-flow errors to pass through. */
export function unstable_rethrow(_err: unknown): void {}
