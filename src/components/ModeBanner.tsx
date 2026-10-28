import { isMockMode } from "@/lib/api/config";

/** Makes mock mode impossible to mistake for a live store. Renders nothing in live mode. */
export function ModeBanner({ variant = "store" }: { variant?: "store" | "admin" }) {
  if (!isMockMode) return null;
  return (
    <div className={`mode-banner mode-banner--${variant}`} role="note">
      <strong>Demo data.</strong>{" "}
      {variant === "admin"
        ? "Changes are kept in this server's memory only and reset on restart. No emails are sent and no money moves."
        : "This store is running on sample data. Orders aren't real and no payment is taken."}
    </div>
  );
}
