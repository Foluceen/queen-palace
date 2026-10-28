"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/States";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container">
      <ErrorState title="This page didn't load" message="We couldn't reach the store just now. Check your connection, then try again." onRetry={reset} />
    </div>
  );
}
