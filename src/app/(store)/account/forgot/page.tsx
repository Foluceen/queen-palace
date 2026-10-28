import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/store/account/PasswordReset";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="container section--tight auth-page">
      <header className="page-head">
        <h1 className="h1">Forgot your password?</h1>
        <p className="lede">Enter the email you signed up with and we'll send you a link to choose a new one.</p>
      </header>
      <ForgotPasswordForm />
    </div>
  );
}
