import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/store/account/PasswordReset";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <div className="container section--tight auth-page">
      <header className="page-head">
        <h1 className="h1">Choose a new password</h1>
      </header>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
