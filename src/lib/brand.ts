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

/**
 * The owner's contact details, given by the owner. Used whenever the backend's store settings
 * leave them empty; anything saved in Admin → Shop details replaces them.
 */
/**
 * How delivery works (from the owner): the shop takes the order to the park or driver the
 * customer chooses at no cost; the customer pays the transport from there to them directly.
 */
export const DELIVERY_SUMMARY = "We take your order to the park or driver you choose, free. You pay the transport from there to your location directly to the driver or park.";

export const DEFAULT_CONTACT = { email: "omoboladefadipe@gmail.com", phone: "09019844327" } as const;
