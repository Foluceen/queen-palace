import type { Metadata } from "next";
import { TrackOrder } from "@/components/store/order/TrackOrder";

export const metadata: Metadata = { title: "Track your order", description: "Check the status of your order with its number and your email." };

export default function TrackPage() {
  return (
    <div className="container section--tight">
      <header className="page-head">
        <h1 className="h1">Track your order</h1>
        <p className="lede">Enter the order number from your confirmation email (it starts with QLH-) and the email you used at checkout.</p>
      </header>
      <TrackOrder />
    </div>
  );
}
