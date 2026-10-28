import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { mailHref, mapsHref, telHref, whatsappHref } from "@/lib/contact";
import type { Navigation, StoreSettings } from "@/lib/types";
import { NewsletterForm } from "./NewsletterForm";

export function Footer({ settings, navigation }: { settings: StoreSettings; navigation: Navigation }) {
  const year = new Date().getFullYear();
  const wa = whatsappHref(settings);
  const tel = telHref(settings.phone);
  const mail = mailHref(settings.contactEmail);
  const socials = (["instagram", "tiktok", "facebook"] as const).filter((k) => settings.social[k]);
  const label = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook" } as const;
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <Link href="/" aria-label={`${settings.name} home`} className="site-footer__logo">
            <Logo variant="stacked" title={settings.name} />
          </Link>
          <p className="site-footer__tagline">{settings.tagline}</p>
          <NewsletterForm />
        </div>
        {navigation.footer.map((group) => (
          <nav key={group.id} aria-label={group.title} className="site-footer__col">
            <h2 className="site-footer__heading">{group.title}</h2>
            <ul>
              {group.items.map((i) => (
                <li key={i.id}>
                  <Link href={i.href}>{i.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div className="site-footer__col">
          <h2 className="site-footer__heading">Visit the store</h2>
          <address>
            <p>{settings.address}</p>
            {settings.openingHours ? <p className="muted">{settings.openingHours}</p> : null}
            <p>
              <a href={mapsHref(settings.address)} rel="noopener noreferrer" target="_blank">
                Get directions
              </a>
            </p>
            {tel ? (
              <p>
                <a href={tel}>{settings.phone}</a>
              </p>
            ) : null}
            {wa ? (
              <p>
                <a href={wa} rel="noopener noreferrer" target="_blank">
                  WhatsApp us
                </a>
              </p>
            ) : null}
            {mail ? (
              <p>
                <a href={mail}>{settings.contactEmail}</a>
              </p>
            ) : null}
          </address>
        </div>
      </div>
      <div className="container site-footer__base">
        <p className="small">
          © {year} {settings.name}. Prices in Nigerian naira (₦).
        </p>
        {socials.length ? (
          <ul className="cluster small">
            {socials.map((k) => (
              <li key={k}>
                <a href={settings.social[k]!} rel="noopener noreferrer" target="_blank">
                  {label[k]}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </footer>
  );
}
