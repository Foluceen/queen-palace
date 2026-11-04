import type { ContentPage } from "@/lib/types";

/**
 * The store's policy pages, built into the site. The backend has no content pages yet, so these
 * are shown unless the backend returns its own version of the same page (which then wins).
 *
 * Contact details are not written here: each page ends with the live contact block from the
 * store settings (address, phone, email, WhatsApp), so they stay correct when the owner edits them.
 */

const STORE = "Queen Luxury Hair";
const UPDATED = "2026-11-04T00:00:00.000Z";

const page = (slug: string, title: string, intro: string, blocks: ContentPage["blocks"]): ContentPage => ({ slug, title, intro, blocks, reviewed: true, updatedAt: UPDATED });

export const POLICY_PAGES: Record<string, ContentPage> = {
  terms: page("terms", "Terms and conditions", `These terms apply to every order placed with ${STORE} on this website. By placing an order you agree to them.`, [
    { kind: "heading", text: "Who we are" },
    { kind: "paragraph", text: `${STORE} is a hair and beauty business in Ijoka, Ilesha, Osun State, Nigeria. We sell wigs, frontals, bundles, braiding extensions and hair care products. Our contact details are at the bottom of this page.` },
    { kind: "heading", text: "Products and descriptions" },
    { kind: "list", items: ["We describe each product as accurately as we can, including texture, length, density and colour.", "Lengths are measured with the hair pulled straight, so curly and wavy hair looks shorter when worn.", "Colours can look slightly different on different screens and in different light.", "Products are subject to availability. If an item sells out after you pay, we will tell you and offer a replacement or a full refund."] },
    { kind: "heading", text: "Prices and payment" },
    { kind: "list", items: ["All prices are in Nigerian naira (₦).", "The total you pay, including any delivery fee, is shown at checkout before you pay.", "Payments are processed securely by Paystack by card, bank transfer or USSD. We never see or store your card details.", "If a price on the site is clearly wrong because of an error, we will contact you before sending the order, and you can choose to pay the correct price or cancel for a full refund."] },
    { kind: "heading", text: "Your order" },
    { kind: "list", items: ["Your order is confirmed once Paystack confirms your payment. You will see the confirmation on your order page.", "Keep your order number. You can track your order on our Track order page with your order number and email.", "We may cancel an order if payment is not completed, if we suspect fraud, or if an item is no longer available. Any money paid is refunded in full."] },
    { kind: "heading", text: "Delivery, returns and refunds" },
    { kind: "paragraph", text: "Delivery is covered by our Shipping and delivery policy. Cancellations, returns and refunds are covered by our Refund and cancellation policy. Both form part of these terms." },
    { kind: "heading", text: "Using the hair" },
    { kind: "paragraph", text: "Follow the care guidance for your product. We are not responsible for damage caused by heat above the recommended level, chemical treatments, colouring, cutting or poor installation after delivery." },
    { kind: "heading", text: "Accounts" },
    { kind: "paragraph", text: "An account is optional. If you create one, keep your password private. You are responsible for orders placed from your account." },
    { kind: "heading", text: "Liability" },
    { kind: "paragraph", text: "Nothing in these terms limits your rights under Nigerian consumer protection law, including the Federal Competition and Consumer Protection Act 2018. Where the law allows, our responsibility for any order is limited to the amount you paid for it." },
    { kind: "heading", text: "Governing law" },
    { kind: "paragraph", text: "These terms are governed by the laws of the Federal Republic of Nigeria." },
    { kind: "heading", text: "Changes" },
    { kind: "paragraph", text: "We may update these terms from time to time. The version on this page when you place your order applies to that order." },
  ]),

  privacy: page("privacy", "Privacy policy", `How ${STORE} collects, uses and protects your personal information, in line with the Nigeria Data Protection Act 2023.`, [
    { kind: "heading", text: "Information we collect" },
    { kind: "list", items: ["Order details: your name, email, phone number and delivery address.", "Account details, if you create an account: your name, email, phone number, saved addresses and wishlist. Your password is stored encrypted and we cannot read it.", "Messages you send us through the contact form, WhatsApp, phone or email.", "Reviews you choose to post.", "Basic technical information such as your browser type and the pages you visit, used to keep the site working and secure."] },
    { kind: "heading", text: "Payment information" },
    { kind: "paragraph", text: "Payments are made on Paystack's secure page. Your card number, CVV and PIN go directly to Paystack and are never sent to or stored by us. We only receive confirmation of the payment, its amount and a reference." },
    { kind: "heading", text: "How we use your information" },
    { kind: "list", items: ["To process, deliver and support your order.", "To contact you about your order or delivery.", "To answer your questions and messages.", "To send occasional news and offers, only if you agree to it. You can opt out at any time.", "To prevent fraud and keep the site secure."] },
    { kind: "heading", text: "Who we share it with" },
    { kind: "paragraph", text: "We never sell your information. We share only what is needed with the companies that help us run the store: Paystack (payments), delivery partners (your name, phone and address, to deliver your order), and our website and hosting providers. We may also share information where the law requires it." },
    { kind: "heading", text: "How long we keep it" },
    { kind: "paragraph", text: "We keep order records for as long as needed for accounting and legal purposes. You can ask us to delete your account at any time." },
    { kind: "heading", text: "Cookies" },
    { kind: "paragraph", text: "We use essential cookies to keep your bag and sign-in working. We do not use advertising cookies." },
    { kind: "heading", text: "Your rights" },
    { kind: "paragraph", text: "You can ask to see the information we hold about you, correct it, delete it, or stop receiving marketing messages. Contact us using the details below and we will respond within 30 days." },
    { kind: "heading", text: "Security" },
    { kind: "paragraph", text: "Our site uses encrypted connections (HTTPS), and access to customer information is limited to the people who need it to run the store." },
  ]),

  returns: page("returns", "Refund and cancellation policy", "When you can cancel an order, return an item and get your money back.", [
    { kind: "heading", text: "Cancelling an order" },
    { kind: "list", items: ["You can cancel any time before your order is sent out. Contact us with your order number and we will refund you in full.", "Once an order has been sent out, it can no longer be cancelled, but you may be able to return it under this policy."] },
    { kind: "heading", text: "Items that can be returned" },
    { kind: "paragraph", text: "Contact us within 7 days of receiving your order. To be returned, items must be:" },
    { kind: "list", items: ["Unworn, unwashed and unstyled.", "With the lace uncut and any hair bands, labels and packaging still in place.", "Unopened, for braiding hair and hair care products."] },
    { kind: "heading", text: "Items that can't be returned" },
    { kind: "list", items: ["Hair that has been worn, washed, cut, coloured, styled or had its lace cut.", "Opened hair care products, for hygiene reasons.", "Items made, cut or coloured specially for you."] },
    { kind: "heading", text: "Wrong, damaged or faulty items" },
    { kind: "paragraph", text: "If you receive the wrong item, or an item that is damaged or faulty, contact us within 48 hours of delivery with your order number and photos. We will replace it or refund you in full, including the delivery fee, and cover the cost of sending it back." },
    { kind: "heading", text: "How to return an item" },
    { kind: "list", items: ["Contact us with your order number, the item and the reason, with photos.", "We will confirm whether the return is approved and how to send it back.", "Bring the item to our store in Ilesha or send it by courier. Unless the item was wrong or faulty, the cost of returning it is yours.", "We check the item when it arrives and confirm your refund."] },
    { kind: "heading", text: "Refunds" },
    { kind: "list", items: ["Approved refunds are paid back to the card or account you paid with, through Paystack.", "We start the refund within 3 working days of approving it. Your bank usually shows it within 5 to 10 working days after that.", "Delivery fees are refunded only for cancelled orders and for wrong, damaged or faulty items.", "If you prefer, we can exchange the item for another product instead of a refund."] },
  ]),

  shipping: page("shipping", "Shipping and delivery policy", "How we prepare and deliver your order, how long it takes and what it costs.", [
    { kind: "heading", text: "Where we deliver" },
    { kind: "paragraph", text: "We deliver within Ilesha, across Osun State and to other states in Nigeria. Enter your state at checkout to see the delivery options available for your address." },
    { kind: "heading", text: "Delivery fees" },
    { kind: "paragraph", text: "The delivery fee depends on your location and is shown at checkout before you pay. It is included in your order total." },
    { kind: "heading", text: "How long it takes" },
    { kind: "list", items: ["We prepare your order within 1 to 2 working days after your payment is confirmed.", "Delivery then usually takes 3 to 7 working days, depending on your location. The estimate for your address is shown at checkout.", "Working days are Monday to Saturday, excluding public holidays.", "Delays can happen because of weather, holidays or courier issues. We will keep you informed if your order is delayed."] },
    { kind: "heading", text: "Pickup in Ilesha" },
    { kind: "paragraph", text: "You can collect your order from our store at Ijoka, Ilesha. We will contact you when it is ready. Please bring your order number." },
    { kind: "heading", text: "Tracking your order" },
    { kind: "paragraph", text: "Check your order's status any time on our Track order page with your order number and email, or from your account if you have one. We will also contact you by phone about delivery." },
    { kind: "heading", text: "Receiving your order" },
    { kind: "list", items: ["Please make sure someone is available to receive the order at the address and phone number you gave.", "Check your package when it arrives. If anything is missing, wrong or damaged, contact us within 48 hours with photos.", "If a delivery fails because the address or phone number is wrong or no one is available, a re-delivery fee may apply."] },
  ]),

  about: page("about", `About ${STORE}`, "A hair and beauty store in Ijoka, Ilesha, Osun State, Nigeria.", [
    { kind: "heading", text: "What we sell" },
    { kind: "list", items: ["Wigs and frontals, including Futura wigs, bone straight and bouncy styles.", "Braiding extensions.", "Hair care products and tools."] },
    { kind: "heading", text: "Shopping with us" },
    { kind: "paragraph", text: "Order online and pay securely with Paystack by card, bank transfer or USSD. We deliver across Nigeria, or you can pick up your order from our store in Ilesha." },
  ]),

  "hair-care": page("hair-care", "Hair care guide", "How to wash, store and refresh each kind of hair, so your install lasts.", [
    { kind: "heading", text: "Bone straight and human hair" },
    { kind: "list", items: ["Wash with a sulphate-free shampoo when it feels heavy, usually every one to two weeks.", "Condition from mid-length to ends only, keeping product off the lace.", "Let it air dry flat on a towel, then straighten on medium heat with a heat protectant.", "Sleep in a satin bonnet or wrap."] },
    { kind: "heading", text: "Futura fibre" },
    { kind: "list", items: ["Use cool water; hot water relaxes the curl pattern.", "Keep curling irons and straighteners below 180°C.", "Store it on a stand to keep its shape."] },
    { kind: "heading", text: "Braids" },
    { kind: "list", items: ["Foam-wash your scalp with diluted shampoo.", "Oil the scalp lightly, not the braids.", "Take braids out in good time to protect your edges."] },
  ]),

  faq: page("faq", "Frequently asked questions", "Quick answers about ordering, paying and delivery.", [
    { kind: "qa", question: "How do I pay?", answer: "Pay securely with Paystack by card, bank transfer or USSD. Your card details go straight to Paystack; we never see them." },
    { kind: "qa", question: "How much is delivery and how long does it take?", answer: "It depends on your location. Enter your state at checkout to see the delivery fee and estimated time before you pay. See our Shipping and delivery policy for details." },
    { kind: "qa", question: "Can I pick up my order?", answer: "Yes, from our store in Ijoka, Ilesha. We will contact you when it's ready." },
    { kind: "qa", question: "Can I cancel or return my order?", answer: "You can cancel before your order is sent out for a full refund. Unworn items with the lace uncut can be returned within 7 days. See our Refund and cancellation policy." },
    { kind: "qa", question: "How is hair length measured?", answer: "Lengths are measured with the hair pulled straight, so curly and wavy hair looks shorter when worn." },
    { kind: "qa", question: "How do I track my order?", answer: "Use the Track order page with your order number and the email you used at checkout." },
  ]),
};

/** Other addresses people (and payment reviewers) commonly try for the same pages. */
export const POLICY_ALIASES: Record<string, string> = {
  "terms-and-conditions": "terms",
  "terms-of-service": "terms",
  "privacy-policy": "privacy",
  "refund-policy": "returns",
  refunds: "returns",
  "return-policy": "returns",
  "cancellation-policy": "returns",
  "shipping-policy": "shipping",
  delivery: "shipping",
  "delivery-policy": "shipping",
  "about-us": "about",
  "contact-us": "contact",
};
