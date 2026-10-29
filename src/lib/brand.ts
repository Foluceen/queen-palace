import type { BrandColors } from "@/lib/types";

/**
 * Queen Luxury Hair house palette: hot pink #FF35B9, soft pink #FFA3DF, black #000000, white #FFFFFF.
 * "gold" holds the soft pink and "burgundy" the hot pink (legacy field names in the contract).
 * The storefront is always dark; the light values only apply to the admin's light mode.
 */
export const DEFAULT_BRAND_COLORS: BrandColors = {
  gold: "#ffa3df",
  burgundy: "#ff35b9",
  lightBackground: "#fbf6f2",
  lightSurface: "#f4ebe5",
  darkBackground: "#000000",
  darkSurface: "#0d0d0d",
};

export const DEFAULT_TAGLINE = "Luxury hair, crowned for you.";
