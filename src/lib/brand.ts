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
export const DEFAULT_CONTACT = { email: "omoboladefadipe@gmail.com", phone: "09019844327" } as const;

/** The shop's social accounts (from the owner). Used when the store settings leave them empty. */
export const DEFAULT_SOCIAL = {
  instagram: "https://www.instagram.com/queenluxuryhair001/",
  tiktok: "https://www.tiktok.com/@queenpalace234",
} as const;
