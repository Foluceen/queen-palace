import { whatsappHref } from "@/lib/contact";
import type { StoreSettings } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";

/** Shown only when a WhatsApp number has been set in admin → Branding & store. */
export function FloatingWhatsApp({ settings }: { settings: StoreSettings }) {
  const href = whatsappHref(settings, `Hi ${settings.name}, I have a question.`);
  if (!href) return null;
  return (
    <a className="wa-float" href={href} target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp">
      <Icon name="whatsapp" size={26} />
    </a>
  );
}
