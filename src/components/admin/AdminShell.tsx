"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { isMockMode } from "@/lib/api/config";
import type { Permission } from "@/lib/types";
import { useAdmin } from "./AdminSession";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  permission: Permission;
}

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: "dashboard", permission: "dashboard:read" }],
  },
  {
    label: "Sell",
    items: [
      { href: "/admin/orders", label: "Orders", icon: "receipt", permission: "orders:read" },
      { href: "/admin/discounts", label: "Discounts", icon: "tag", permission: "discounts:write" },
      { href: "/admin/reviews", label: "Reviews and messages", icon: "chat", permission: "inquiries:respond" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: "box", permission: "products:read" },
      { href: "/admin/inventory", label: "Inventory", icon: "layers", permission: "products:read" },
      { href: "/admin/collections", label: "Collections", icon: "grip", permission: "products:read" },
      { href: "/admin/media", label: "Media library", icon: "image", permission: "products:read" },
    ],
  },
  {
    label: "Store",
    items: [
      { href: "/admin/storefront", label: "Homepage and menus", icon: "edit", permission: "content:write" },
      { href: "/admin/settings/shipping-payments", label: "Shipping and payments", icon: "truck", permission: "settings:write" },
      { href: "/admin/settings/branding", label: "Branding and details", icon: "palette", permission: "settings:write" },
      { href: "/admin/staff", label: "Staff and roles", icon: "users", permission: "staff:manage" },
    ],
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { session, can, signOut } = useAdmin();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <div className={`ashell ${open ? "is-nav-open" : ""}`}>
      <aside className="ashell__nav" aria-label="Admin">
        <div className="ashell__brand">
          <Link href="/admin" className="wordmark">
            Ìrun
          </Link>
          <span className="small muted">Admin</span>
        </div>
        <nav>
          {groups.map((g) => {
            const items = g.items.filter((i) => can(i.permission) || (i.href === "/admin/reviews" && can("reviews:moderate")));
            if (!items.length) return null;
            return (
              <div key={g.label} className="ashell__group">
                <p className="ashell__group-label">{g.label}</p>
                <ul>
                  {items.map((i) => (
                    <li key={i.href}>
                      <Link href={i.href} className={`ashell__link ${isActive(i.href) ? "is-active" : ""}`} aria-current={isActive(i.href) ? "page" : undefined}>
                        <Icon name={i.icon} size={18} />
                        {i.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
        <div className="ashell__me">
          <div>
            <p className="ashell__name">{session.staff.name}</p>
            <p className="small muted">{session.role.name}</p>
          </div>
          <button type="button" className="icon-btn" onClick={() => void signOut()} aria-label="Sign out">
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>
      <div className="ashell__main">
        <div className="ashell__top">
          <button type="button" className="icon-btn ashell__menu" onClick={() => setOpen((o) => !o)} aria-label="Toggle admin menu" aria-expanded={open}>
            <Icon name="menu" />
          </button>
          {isMockMode ? (
            <p className="ashell__mock small">
              <strong>Demo data.</strong> Changes live in server memory and reset on restart. No emails are sent and no money moves.
            </p>
          ) : (
            <span />
          )}
          <Link href="/" className="btn btn--ghost btn--sm" target="_blank">
            View store
            <Icon name="external" size={14} />
          </Link>
        </div>
        <main id="admin-main" className="ashell__content">
          {children}
        </main>
      </div>
      {open ? <button type="button" className="ashell__scrim" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
    </div>
  );
}
