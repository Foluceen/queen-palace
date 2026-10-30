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

/** The six things the owner does every day, in plain words. */
const mainItems: NavItem[] = [
  { href: "/admin", label: "Home", icon: "dashboard", permission: "dashboard:read" },
  { href: "/admin/products", label: "Products", icon: "box", permission: "products:read" },
  { href: "/admin/orders", label: "Orders", icon: "receipt", permission: "orders:read" },
  { href: "/admin/collections", label: "Collections", icon: "grip", permission: "products:read" },
  { href: "/admin/reviews", label: "Reviews", icon: "star", permission: "reviews:moderate" },
  { href: "/admin/inquiries", label: "Messages", icon: "chat", permission: "inquiries:respond" },
];

/** Everything else, folded under "More" so the menu stays short. */
const moreItems: NavItem[] = [
  { href: "/admin/inventory", label: "Stock", icon: "layers", permission: "products:read" },
  { href: "/admin/customers", label: "Customers", icon: "users", permission: "customers:read" },
  { href: "/admin/discounts", label: "Discount codes", icon: "tag", permission: "discounts:write" },
  { href: "/admin/analytics", label: "Sales report", icon: "chart", permission: "analytics:read" },
  { href: "/admin/media", label: "Photos", icon: "image", permission: "products:read" },
  { href: "/admin/storefront", label: "Homepage", icon: "edit", permission: "content:write" },
  { href: "/admin/navigation", label: "Menus", icon: "link", permission: "content:write" },
  { href: "/admin/pages", label: "Pages", icon: "file", permission: "content:write" },
  { href: "/admin/settings/branding", label: "Shop details & colours", icon: "palette", permission: "settings:write" },
  { href: "/admin/settings/shipping-payments", label: "Delivery & payment", icon: "truck", permission: "settings:write" },
  { href: "/admin/staff", label: "Staff", icon: "users", permission: "staff:manage" },
  { href: "/admin/product-types", label: "Product types", icon: "sliders", permission: "products:read" },
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
          <ul className="ashell__main-nav">
            {mainItems
              .filter((i) => can(i.permission))
              .map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className={`ashell__link ${isActive(i.href) ? "is-active" : ""}`} aria-current={isActive(i.href) ? "page" : undefined}>
                    <Icon name={i.icon} size={20} />
                    {i.label}
                  </Link>
                </li>
              ))}
          </ul>
          {moreItems.some((i) => can(i.permission)) ? (
            <details className="ashell__more" open={moreItems.some((i) => isActive(i.href)) || undefined}>
              <summary>
                More
                <Icon name="chevronDown" size={16} />
              </summary>
              <ul>
                {moreItems
                  .filter((i) => can(i.permission))
                  .map((i) => (
                    <li key={i.href}>
                      <Link href={i.href} className={`ashell__link ashell__link--sm ${isActive(i.href) ? "is-active" : ""}`} aria-current={isActive(i.href) ? "page" : undefined}>
                        <Icon name={i.icon} size={16} />
                        {i.label}
                      </Link>
                    </li>
                  ))}
              </ul>
            </details>
          ) : null}
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
              <span className="ashell__store-label">See my shop</span>
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
