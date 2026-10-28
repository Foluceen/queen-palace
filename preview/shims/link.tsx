/** Stand-in for next/link: internal paths become in-page hash navigation. */
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { navigate, pathToHash } from "../router";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string; query?: Record<string, string> };
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  children?: ReactNode;
};

export default function Link({ href, prefetch: _p, replace, scroll, onClick, target, rel, ...rest }: Props) {
  const h = typeof href === "string" ? href : `${href.pathname ?? "/"}${href.query ? `?${new URLSearchParams(href.query)}` : ""}`;
  const internal = h.startsWith("/");
  return (
    <a
      {...rest}
      href={internal ? `#${pathToHash(h)}` : h}
      target={internal ? undefined : target}
      rel={internal ? undefined : rel}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || !internal || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        navigate(h, { replace, scroll });
      }}
    />
  );
}
