import type { Metadata } from "next";
import { WishlistView } from "@/components/store/account/WishlistView";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default function WishlistPage() {
  return (
    <div className="container section--tight">
      <h1 className="h1 page-head">Wishlist</h1>
      <WishlistView />
    </div>
  );
}
