import type { Metadata } from "next";
import { ContactForm } from "@/components/store/ContactForm";
import { Icon } from "@/components/ui/Icon";
import { mailHref, mapsHref, telHref, whatsappHref } from "@/lib/contact";
import { getSettings } from "@/lib/data/storefront";

export const metadata: Metadata = { title: "Contact us", description: "Questions about an order, a texture or a style? Send us a message or visit the store in Ijoka, Ilesha." };

export default async function ContactPage() {
  const s = await getSettings();
  const wa = whatsappHref(s, `Hi ${s.name}, I have a question.`);
  const tel = telHref(s.phone);
  const mail = mailHref(s.contactEmail);
  return (
    <div className="container section--tight contact">
      <header className="page-head">
        <p className="eyebrow">Contact</p>
        <h1 className="h1">We would love to hear from you</h1>
        <p className="lede">Ask about an order, a texture, a length or a style. Send a message below{wa ? " or chat with us on WhatsApp" : ""}.</p>
      </header>
      <div className="contact__grid">
        <ContactForm />
        <aside className="contact__aside stack">
          {wa || tel || mail ? (
            <>
              <h2 className="h3">Other ways to reach us</h2>
              {wa ? (
                <p>
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn--whatsapp">
                    <Icon name="whatsapp" size={18} /> Message on WhatsApp
                  </a>
                </p>
              ) : null}
              {tel ? (
                <p>
                  Call <a href={tel}>{s.phone}</a>
                </p>
              ) : null}
              {mail ? (
                <p>
                  Email <a href={mail}>{s.contactEmail}</a>
                </p>
              ) : null}
            </>
          ) : null}
          <h2 className="h3">Visit the store</h2>
          <p>{s.address}</p>
          {s.openingHours ? <p className="muted">{s.openingHours}</p> : null}
          <p>
            <a href={mapsHref(s.address)} target="_blank" rel="noopener noreferrer" className="btn btn--ghost">
              <Icon name="mapPin" size={18} /> Get directions
            </a>
          </p>
        </aside>
      </div>
    </div>
  );
}
