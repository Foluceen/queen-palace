import type { Metadata } from "next";
import { CheckoutView } from "@/components/store/checkout/CheckoutView";
import { storefront } from "@/lib/data/storefront";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const payment = await storefront().paymentOptions();
  return (
    <div className="container section--tight">
      <h1 className="h1 page-head">Checkout</h1>
      <CheckoutView payment={payment} />
    </div>
  );
}
