import Link from "next/link";
import type { Navigation, StoreSettings } from "@/lib/types";
import { NewsletterForm } from "./NewsletterForm";

export function Footer({ settings, navigation }: { settings: StoreSettings; navigation: Navigation }) {
  const year = new Date().getFullYear();
  const wa = settings.whatsapp.replace(/\D/g, "");
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <p className="site-footer__mark">{settings.name}</p>
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
          <h2 className="site-footer__heading">Visit or message us</h2>
          <address>
            <p>{settings.address}</p>
            <p>
              <a href={`tel:${settings.phone.replace(/\s/g, "")}`}>{settings.phone}</a>
            </p>
            <p>
              <a href={`https://wa.me/${wa}`} rel="noopener noreferrer" target="_blank">
                WhatsApp us
              </a>
            </p>
            <p>
              <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
            </p>
          </address>
        </div>
      </div>
      <div className="container site-footer__base">
        <p className="small">
          © {year} {settings.name}. Prices in Nigerian naira.
        </p>
        <ul className="cluster small">
          {settings.social.instagram ? (
            <li>
              <a href={settings.social.instagram} rel="noopener noreferrer" target="_blank">
                Instagram
              </a>
            </li>
          ) : null}
          {settings.social.tiktok ? (
            <li>
              <a href={settings.social.tiktok} rel="noopener noreferrer" target="_blank">
                TikTok
              </a>
            </li>
          ) : null}
          {settings.social.facebook ? (
            <li>
              <a href={settings.social.facebook} rel="noopener noreferrer" target="_blank">
                Facebook
              </a>
            </li>
          ) : null}
        </ul>
      </div>
    </footer>
  );
}
