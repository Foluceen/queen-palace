import Image from "next/image";
import Link from "next/link";
import type { Navigation, StoreSettings } from "@/lib/types";
import { HeaderActions, MobileMenu } from "./HeaderClient";

export function Wordmark({ settings }: { settings: StoreSettings }) {
  return settings.logo ? (
    <Image src={settings.logo.url} alt={settings.name} width={settings.logo.width} height={settings.logo.height} className="wordmark__img" priority />
  ) : (
    <span className="wordmark">{settings.name}</span>
  );
}

export function Header({ settings, navigation }: { settings: StoreSettings; navigation: Navigation }) {
  return (
    <header className="site-header">
      {settings.announcement.enabled ? (
        <div className="announce">
          {settings.announcement.href ? <Link href={settings.announcement.href}>{settings.announcement.message}</Link> : <span>{settings.announcement.message}</span>}
        </div>
      ) : null}
      <div className="site-header__bar container">
        <MobileMenu navigation={navigation} storeName={settings.name} />
        <Link href="/" className="site-header__logo" aria-label={`${settings.name} home`}>
          <Wordmark settings={settings} />
        </Link>
        <nav className="site-nav" aria-label="Main">
          <ul>
            {navigation.main.map((item) => (
              <li key={item.id} className={item.children?.length ? "has-children" : undefined}>
                <Link href={item.href} className="site-nav__link">
                  {item.label}
                </Link>
                {item.children?.length ? (
                  <div className="site-nav__menu">
                    <ul>
                      {item.children.map((c) => (
                        <li key={c.id}>
                          <Link href={c.href}>{c.label}</Link>
                        </li>
                      ))}
                      <li>
                        <Link href={item.href} className="site-nav__all">
                          Shop everything
                        </Link>
                      </li>
                    </ul>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>
        <HeaderActions />
      </div>
    </header>
  );
}
