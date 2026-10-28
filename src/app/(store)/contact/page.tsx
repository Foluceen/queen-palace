import type { Metadata } from "next";
import { ContactForm } from "@/components/store/ContactForm";
import { getSettings } from "@/lib/data/storefront";

export const metadata: Metadata = { title: "Contact us", description: "Questions about an order, a texture, or wholesale? Message us." };

export default async function ContactPage() {
  const s = await getSettings();
  const wa = s.whatsapp.replace(/\D/g, "");
  return (
    <div className="container section--tight contact">
      <header className="page-head">
        <h1 className="h1">Contact us</h1>
        <p className="lede">We reply within a few hours, Monday to Saturday. WhatsApp is fastest.</p>
      </header>
      <div className="contact__grid">
        <ContactForm />
        <aside className="contact__aside stack">
          <h2 className="h3">Other ways to reach us</h2>
          <p>
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="btn btn--ghost">
              Message on WhatsApp
            </a>
          </p>
          <p>
            Call <a href={`tel:${s.phone.replace(/\s/g, "")}`}>{s.phone}</a>
          </p>
          <p>
            Email <a href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a>
          </p>
          <h2 className="h3">Studio</h2>
          <p className="muted">{s.address}. Pickups and installs, Monday to Saturday, 10am to 6pm.</p>
        </aside>
      </div>
    </div>
  );
}
