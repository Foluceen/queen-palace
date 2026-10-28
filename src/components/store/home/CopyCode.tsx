"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

/** Shows a discount code with a copy button. The code is still validated by the backend at checkout. */
export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="promo__code"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard unavailable: the code is visible to copy by hand */
        }
      }}
    >
      <span className="promo__code-label">Code</span>
      <span className="promo__code-value">{code}</span>
      <span className="promo__code-action" aria-live="polite">
        {copied ? (
          "Copied"
        ) : (
          <>
            <Icon name="copy" size={15} /> Copy
          </>
        )}
      </span>
    </button>
  );
}
