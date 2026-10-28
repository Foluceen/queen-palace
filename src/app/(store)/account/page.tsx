import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountView } from "@/components/store/account/AccountView";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="container section--tight">
      <h1 className="h1 page-head">Your account</h1>
      <Suspense>
        <AccountView />
      </Suspense>
    </div>
  );
}
