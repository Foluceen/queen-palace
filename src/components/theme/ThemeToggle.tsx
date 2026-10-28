"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { applyPreference, readPreference, resolve, THEME_EVENT, type ThemePreference } from "@/lib/theme";

const options: { value: ThemePreference; label: string; icon: IconName }[] = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "Match device", icon: "monitor" },
];

/**
 * Theme menu: a button that opens a small radio menu (Light, Dark, Match device).
 * Keyboard: Enter/Space opens, arrows move, Esc closes and returns focus.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [pref, setPref] = useState<ThemePreference | null>(null);
  const [resolved, setResolved] = useState<"light" | "dark">("light");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    const sync = () => {
      const p = readPreference();
      setPref(p);
      setResolved(resolve(p));
    };
    sync();
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener?.("change", sync);
    window.addEventListener(THEME_EVENT, sync);
    return () => {
      mq?.removeEventListener?.("change", sync);
      window.removeEventListener(THEME_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    const first = wrapRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]') ?? wrapRef.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"]');
    first?.focus();
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const choose = (p: ThemePreference) => {
    applyPreference(p);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const current = options.find((o) => o.value === pref);
  return (
    <div className={`theme-menu ${className ?? ""}`} ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Theme: ${current?.label ?? "Match device"}. Change theme`}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name={pref === "system" || pref === null ? "monitor" : resolved === "dark" ? "moon" : "sun"} />
      </button>
      {open ? (
        <ul
          id={menuId}
          className="theme-menu__list"
          role="menu"
          aria-label="Theme"
          onKeyDown={(e) => {
            const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
            const i = items.indexOf(document.activeElement as HTMLButtonElement);
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              buttonRef.current?.focus();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              items[(i + 1) % items.length]?.focus();
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              items[(i - 1 + items.length) % items.length]?.focus();
            } else if (e.key === "Tab") setOpen(false);
          }}
        >
          {options.map((o) => (
            <li key={o.value} role="none">
              <button type="button" role="menuitemradio" aria-checked={pref === o.value} className="theme-menu__item" onClick={() => choose(o.value)}>
                <Icon name={o.icon} size={18} />
                {o.label}
                {pref === o.value ? <Icon name="check" size={16} className="theme-menu__check" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
