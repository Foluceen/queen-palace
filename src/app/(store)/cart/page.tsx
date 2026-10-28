import type { Metadata } from "next";
import { CartPageView } from "@/components/store/cart/CartPageView";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="container section--tight">
      <h1 className="h1 page-head">Your bag</h1>
      <CartPageView />
    </div>
  );
}
