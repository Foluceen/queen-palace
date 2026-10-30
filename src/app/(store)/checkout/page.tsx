import type { Metadata } from "next";
import { CheckoutView } from "@/components/store/checkout/CheckoutView";
import { paystackOnly } from "@/lib/checkout";
import { storefront } from "@/lib/data/storefront";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  // Paystack is the only way to pay; anything else the backend lists is not offered.
  const payment = paystackOnly(await storefront().paymentOptions());
  return (
    <div className="container section--tight">
      <h1 className="h1 page-head">Checkout</h1>
      <CheckoutView payment={payment} />
    </div>
  );
}
