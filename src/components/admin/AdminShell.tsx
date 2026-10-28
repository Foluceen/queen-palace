"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { isMockMode } from "@/lib/api/config";
import type { Permission } from "@/lib/types";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AdminSearch } from "./AdminSearch";
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
    items: [
      { href: "/admin", label: "Dashboard", icon: "dashboard", permission: "dashboard:read" },
      { href: "/admin/analytics", label: "Analytics", icon: "chart", permission: "analytics:read" },
    ],
  },
  {
    label: "Sell",
    items: [
      { href: "/admin/orders", label: "Orders", icon: "receipt", permission: "orders:read" },
      { href: "/admin/customers", label: "Customers", icon: "users", permission: "customers:read" },
      { href: "/admin/inquiries", label: "Messages", icon: "chat", permission: "inquiries:respond" },
      { href: "/admin/discounts", label: "Discounts", icon: "tag", permission: "discounts:write" },
      { href: "/admin/reviews", label: "Reviews", icon: "star", permission: "reviews:moderate" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: "box", permission: "products:read" },
      { href: "/admin/inventory", label: "Inventory", icon: "layers", permission: "products:read" },
      { href: "/admin/collections", label: "Collections", icon: "grip", permission: "products:read" },
      { href: "/admin/product-types", label: "Product types", icon: "sliders", permission: "products:read" },
      { href: "/admin/media", label: "Media library", icon: "image", permission: "products:read" },
    ],
  },
  {
    label: "Online store",
    items: [
      { href: "/admin/storefront", label: "Homepage", icon: "edit", permission: "content:write" },
      { href: "/admin/navigation", label: "Navigation", icon: "link", permission: "content:write" },
      { href: "/admin/pages", label: "Pages", icon: "file", permission: "content:write" },
      { href: "/admin/settings/branding", label: "Branding and store", icon: "palette", permission: "settings:write" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/settings/shipping-payments", label: "Shipping and payments", icon: "truck", permission: "settings:write" },
      { href: "/admin/staff", label: "Staff and roles", icon: "settings", permission: "staff:manage" },
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
          <Link href="/admin" className="ashell__logo" aria-label="Queen Luxury Hair admin home">
            <Logo variant="horizontal" title="" />
          </Link>
        </div>
        <nav>
          {groups.map((g) => {
            const items = g.items.filter((i) => can(i.permission));
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
          <AdminSearch />
          <div className="ashell__tools">
            <ThemeToggle />
            <Link href="/" className="btn btn--ghost btn--sm" target="_blank">
              <span className="ashell__store-label">View store</span>
              <Icon name="external" size={14} />
            </Link>
          </div>
        </div>
        {isMockMode ? (
          <p className="ashell__mock small" role="note">
            <strong>Demo mode.</strong> Sample data in server memory, reset on restart. Figures are not real sales. No emails are sent and no money moves.
          </p>
        ) : null}
        <main id="admin-main" className="ashell__content">
          {children}
        </main>
      </div>
      {open ? <button type="button" className="ashell__scrim" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
    </div>
  );
}
