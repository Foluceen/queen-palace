import { formatNaira, formatPriceRange } from "@/lib/format";
import type { Kobo } from "@/lib/types";

interface PriceProps {
  amount?: Kobo;
  range?: { min: Kobo; max: Kobo };
  compareAt?: Kobo | null;
  compareRange?: { min: Kobo; max: Kobo } | null;
  className?: string;
}

/** Displays backend-provided prices in naira. Never computes a price itself. */
export function Price({ amount, range, compareAt, compareRange, className }: PriceProps) {
  const main = amount !== undefined ? formatNaira(amount) : range ? formatPriceRange(range) : "";
  const was = compareAt ? formatNaira(compareAt) : compareRange && range && compareRange.min > range.min ? formatNaira(compareRange.min) : null;
  return (
    <span className={`price ${className ?? ""}`}>
      <span className="price__now">{main}</span>
      {was ? (
        <>
          <span className="sr-only">, was </span>
          <s className="price__was">{was}</s>
        </>
      ) : null}
    </span>
  );
}
