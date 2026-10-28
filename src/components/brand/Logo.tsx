import { CROWN_PATH, HORIZONTAL, MONOGRAM_PATH, STACKED } from "./logo-paths";

interface LogoProps {
  /** horizontal: small crown over "QUEEN" and the script line (header). compact: crowned-Q monogram. stacked: monogram over the wordmark. */
  variant?: "horizontal" | "compact" | "stacked";
  className?: string;
  /** Accessible name. Pass "" when a visible label already names the link. */
  title?: string;
}

/**
 * The built-in vector logo. Colours come from theme tokens (--logo-mark, --logo-text),
 * so it is correct in light and dark mode without separate files.
 */
export function Logo({ variant = "horizontal", className, title = "Queen Luxury Hair" }: LogoProps) {
  const a11y = title ? { role: "img", "aria-label": title } : { "aria-hidden": true };
  if (variant === "compact") {
    return (
      <svg viewBox="0 0 64 64" className={`logo logo--compact ${className ?? ""}`} {...a11y}>
        <path d={MONOGRAM_PATH} className="logo__mark" />
      </svg>
    );
  }
  if (variant === "stacked") {
    return (
      <svg viewBox={`0 0 ${STACKED.width} ${STACKED.height}`} className={`logo logo--stacked ${className ?? ""}`} {...a11y}>
        <path d={MONOGRAM_PATH} className="logo__mark" transform={`translate(${STACKED.markX} 0)`} />
        <path d={STACKED.line1} className="logo__text" />
        <path d={STACKED.line2} className="logo__text" />
      </svg>
    );
  }
  return (
    <svg viewBox={`0 0 ${HORIZONTAL.width} ${HORIZONTAL.height}`} className={`logo logo--horizontal ${className ?? ""}`} {...a11y}>
      <g transform={HORIZONTAL.markTransform}>
        <path d={CROWN_PATH} className="logo__mark" />
      </g>
      <path d={HORIZONTAL.line1} className="logo__text" />
      <path d={HORIZONTAL.line2} className="logo__text" />
    </svg>
  );
}

/** Decorative crown monogram (always aria-hidden). */
export function Monogram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={`logo logo--compact ${className ?? ""}`} aria-hidden>
      <path d={MONOGRAM_PATH} className="logo__mark" />
    </svg>
  );
}
