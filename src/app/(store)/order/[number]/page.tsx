import type { Metadata } from "next";
import { OrderConfirmation } from "@/components/store/order/OrderConfirmation";
import { first, type RawSearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<RawSearchParams> }) {
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  const token = first(sp.token);
  // Paystack appends ?reference=, Flutterwave ?tx_ref= on return.
  const reference = first(sp.reference) ?? first(sp.tx_ref) ?? null;
  return (
    <div className="container section--tight">
      {/* Without a token the backend still shows the order to the signed-in customer who placed it. */}
      <OrderConfirmation number={decodeURIComponent(number)} token={token ?? ""} reference={token ? reference : null} />
    </div>
  );
}
