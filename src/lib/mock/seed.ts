import { DEFAULT_BRAND_COLORS } from "@/lib/brand";
/**
 * Initial data for mock mode. This is SEED data, loaded into the mock database once per
 * server process; nothing in the UI imports it directly. The Fastify backend should seed
 * PostgreSQL with equivalent rows (see docs/BACKEND_INTEGRATION.md).
 *
 * Business facts used here are only the ones the owner supplied: the store name and its
 * address in Ijoka, Ilesha. Contact details, bank details and social links are left empty
 * for the owner to fill in. Catalog items, prices, reviews and orders are sample data.
 */
import type {
  Collection,
  ContentPage,
  Discount,
  HomepageSection,
  Inquiry,
  Media,
  Navigation,
  PaymentSettings,
  Product,
  ProductOption,
  ProductType,
  Review,
  Role,
  SavedAddress,
  ShippingSettings,
  Staff,
  StoreSettings,
  Variant,
} from "@/lib/types";

const NAIRA = 100; // kobo per naira
const n = (naira: number) => Math.round(naira * NAIRA);
const iso = (daysAgo: number, hour = 10) => {
  const d = new Date(Date.UTC(2026, 9, 26, hour, 0, 0));
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
};

/* Deterministic pseudo-random so seed data is stable between restarts. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const STORE_ADDRESS = "Ijoka, beside Ibiyemi Building Material, Ilesha, Osun State, Nigeria";

/* ------------------------------------------------------------------ media */

function media(name: string, alt: string, tags: string[], width = 960, height = 1200): Media {
  return {
    id: `med_${name}`,
    url: `/media/${name}.jpg`,
    alt,
    width,
    height,
    mimeType: "image/jpeg",
    tags,
    createdAt: iso(40),
  };
}

export const seedMedia: Media[] = [
  media("hero-main", "Glossy 1B deep-wave hair on a burgundy backdrop", ["hero"], 1200, 1500),
  media("hero-layer", "Honey blonde body wave strands", ["hero"]),
  media("editorial-bone-straight", "Straight 1B strands falling in parallel", ["editorial"], 1920, 1200),
  media("editorial-care", "Hair care products on a cream shelf", ["editorial", "care"], 1920, 1200),
  media("editorial-store", "Burgundy wave strands framed in an arch", ["editorial"]),
  media("promo-campaign", "Champagne blonde waves on a gold backdrop", ["promo"], 1920, 1200),
  media("collection-futura-wig", "Burgundy 99J Futura fibre waves", ["collection"]),
  media("collection-bone-straight", "Sleek 1B bone straight hair", ["collection"]),
  media("collection-factory-wigs", "Kinky curl texture in natural brown", ["collection"]),
  media("collection-braids-extensions", "Long knotless braids", ["collection"]),
  media("collection-hair-maintains", "Edge control, oil and spray bottles", ["collection", "care"]),
  media("banner-futura-wig", "Futura waves in burgundy, wide banner", ["banner"], 1920, 800),
  media("banner-bone-straight", "Bone straight hair, wide banner", ["banner"], 1920, 800),
  media("banner-factory-wigs", "Curly factory wig texture, wide banner", ["banner"], 1920, 800),
  media("banner-braids-extensions", "Braid extensions, wide banner", ["banner"], 1920, 800),
  media("banner-hair-maintains", "Hair care products, wide banner", ["banner"], 1920, 800),
];

const productImages = (handle: string, alt: string) =>
  [1, 2, 3].map((i) => {
    const m = media(`${handle}-${i}`, i === 1 ? alt : `${alt}, view ${i}`, ["product", handle]);
    seedMedia.push(m);
    return m;
  });

/* ------------------------------------------------------------ collections */

const mediaById = (id: string) => seedMedia.find((m) => m.id === id) ?? null;

function collection(id: string, handle: string, title: string, summary: string, description: string, position: number, seoDescription: string): Collection {
  return {
    id,
    handle,
    title,
    summary,
    description,
    image: mediaById(`med_collection-${handle}`),
    banner: mediaById(`med_banner-${handle}`),
    status: "published",
    position,
    productCount: 0,
    seo: { title, description: seoDescription },
    updatedAt: iso(3 + position),
  };
}

export const seedCollections: Collection[] = [
  collection(
    "col_futura",
    "futura-wig",
    "Futura Wig",
    "Heat-friendly Futura fibre with the movement of human hair.",
    "Futura is a heat-resistant fibre that holds curls, waves and colour at a gentler price than virgin hair. Units come ready to install, so it is an easy way to try a new shade or length.",
    0,
    "Heat-friendly Futura fibre wigs in waves, bobs and colours.",
  ),
  collection(
    "col_bone",
    "bone-straight",
    "Bone Straight",
    "Double-drawn hair, full from root to tip.",
    "Double-drawn bone straight hair keeps its fullness to the very ends. Choose bundles to sew in or a frontal unit ready to wear.",
    1,
    "Double-drawn bone straight bundles and frontal wigs.",
  ),
  collection(
    "col_factory",
    "factory-wigs",
    "Factory Wigs",
    "Ready-made human hair units in curls, waves and bobs.",
    "Factory wigs are fully constructed human hair units, ready to wear. Textures and lengths vary with each delivery.",
    2,
    "Human hair factory wigs in curls, waves and bobs.",
  ),
  collection(
    "col_braids",
    "braids-extensions",
    "Braids Extensions",
    "Pre-stretched braiding hair for knotless, box and boho styles.",
    "Pre-stretched braiding hair for knotless, box and boho styles, sold per pack.",
    3,
    "Pre-stretched braid extensions for knotless and boho braids.",
  ),
  collection(
    "col_maintains",
    "hair-maintains",
    "Hair Maintains",
    "Edge control, bonnets, grips and sprays between installs.",
    "Everything between installs: hold for your edges, satin to sleep in, and sprays that bring back softness and shine.",
    4,
    "Edge control, silk bonnets, wig grips and revive sprays.",
  ),
];

/* ----------------------------------------------------------- product types */

export const seedProductTypes: ProductType[] = [
  {
    id: "type_wig",
    name: "Wig",
    description: "Ready-to-wear units: frontals, closures, bobs and glueless wigs.",
    optionNames: ["Length", "Density", "Lace", "Colour"],
    attributes: [
      { key: "hair", label: "Hair", kind: "text", group: "details", placeholder: "100% human hair, Futura fibre…" },
      { key: "drawn", label: "Drawn", kind: "text", group: "details", placeholder: "Double drawn" },
      { key: "lace", label: "Lace", kind: "text", group: "details", placeholder: "13x4 HD lace front" },
      { key: "cap", label: "Cap size", kind: "text", group: "details", placeholder: "Medium, adjustable straps" },
      { key: "density", label: "Density", kind: "text", group: "details" },
      { key: "colour", label: "Colour", kind: "text", group: "details" },
      { key: "heat", label: "Heat styling", kind: "text", group: "details", placeholder: "Up to 180°C" },
      { key: "lifespan", label: "Lifespan", kind: "text", group: "details" },
      { key: "care", label: "Care instructions", kind: "list", group: "care" },
    ],
    productCount: 0,
  },
  {
    id: "type_bundles",
    name: "Bundles",
    description: "Hair sold by the bundle for sew-ins, with or without a closure.",
    optionNames: ["Length", "Colour"],
    attributes: [
      { key: "hair", label: "Hair", kind: "text", group: "details" },
      { key: "drawn", label: "Drawn", kind: "text", group: "details" },
      { key: "includes", label: "Includes", kind: "text", group: "details", placeholder: "3 bundles + 5x5 closure" },
      { key: "weight", label: "Weight", kind: "text", group: "details", placeholder: "100g per bundle" },
      { key: "colour", label: "Colour", kind: "text", group: "details" },
      { key: "care", label: "Care instructions", kind: "list", group: "care" },
    ],
    productCount: 0,
  },
  {
    id: "type_braiding",
    name: "Braiding hair",
    description: "Packs of braiding hair and curly add-ons.",
    optionNames: ["Length", "Colour"],
    attributes: [
      { key: "hair", label: "Fibre", kind: "text", group: "details" },
      { key: "pack", label: "Pack contents", kind: "text", group: "details" },
      { key: "weight", label: "Weight", kind: "text", group: "details" },
      { key: "ends", label: "Ends", kind: "text", group: "details" },
      { key: "care", label: "Care instructions", kind: "list", group: "care" },
    ],
    productCount: 0,
  },
  {
    id: "type_care",
    name: "Hair care",
    description: "Edge control, sprays, oils and other products you apply.",
    optionNames: ["Size"],
    attributes: [
      { key: "volume", label: "Size", kind: "text", group: "details", placeholder: "100ml" },
      { key: "formula", label: "Formula", kind: "text", group: "details", placeholder: "Leave-in, water based" },
      { key: "hold", label: "Hold", kind: "text", group: "details" },
      { key: "suitable", label: "Suitable for", kind: "text", group: "details" },
      { key: "ingredients", label: "Key ingredients", kind: "list", group: "details" },
      { key: "usage", label: "How to use", kind: "list", group: "usage" },
    ],
    productCount: 0,
  },
  {
    id: "type_accessory",
    name: "Accessory",
    description: "Bonnets, wig grips and tools.",
    optionNames: ["Colour"],
    attributes: [
      { key: "material", label: "Material", kind: "text", group: "details" },
      { key: "fit", label: "Fit", kind: "text", group: "details" },
      { key: "closure", label: "Closure", kind: "text", group: "details" },
      { key: "care", label: "Care instructions", kind: "list", group: "care" },
    ],
    productCount: 0,
  },
];

const TYPE_BY_HANDLE: Record<string, string> = {
  "futura-body-wave": "type_wig",
  "futura-deep-wave-bob": "type_wig",
  "futura-honey-layers": "type_wig",
  "futura-613-straight": "type_wig",
  "bone-straight-double-drawn": "type_wig",
  "bone-straight-super-double": "type_bundles",
  "bone-straight-pixie": "type_wig",
  "bone-straight-bundles": "type_bundles",
  "factory-kinky-curl": "type_wig",
  "factory-water-wave": "type_wig",
  "factory-burgundy-bob": "type_wig",
  "factory-pixie-curl": "type_wig",
  "braids-knotless-xpression": "type_braiding",
  "braids-french-curl": "type_braiding",
  "braids-copper-boho": "type_braiding",
  "care-edge-control": "type_care",
  "care-silk-bonnet": "type_accessory",
  "care-wig-grip-band": "type_accessory",
  "care-revive-spray": "type_care",
};

/** Maps the legacy spec labels in the product seeds below to attribute keys. */
const SPEC_KEY: Record<string, string> = {
  Fibre: "hair",
  Hair: "hair",
  Lace: "lace",
  Cap: "cap",
  Heat: "heat",
  Density: "density",
  Colour: "colour",
  Drawn: "drawn",
  Lifespan: "lifespan",
  Includes: "includes",
  Weight: "weight",
  Pack: "pack",
  Ends: "ends",
  Hold: "hold",
  Base: "ingredients",
  Fabric: "material",
  Fit: "fit",
  Closure: "closure",
  Type: "formula",
  Use: "suitable",
};

/* --------------------------------------------------------------- products */

interface ProductSeed {
  handle: string;
  title: string;
  subtitle: string;
  description: string;
  collectionId: string;
  options: ProductOption[];
  price: (o: Record<string, string>) => number;
  compareAt?: (o: Record<string, string>) => number | null;
  specs: [string, string][];
  care: string[];
  tags: string[];
  featured?: boolean;
  createdDaysAgo: number;
  rating: [number, number];
  alt: string;
  stockSeed: number;
}

const inchPrice = (base: number, step: number, from = 10) => (o: Record<string, string>) => base + (parseInt(o.Length ?? `${from}`, 10) - from) / 2 * step;

const productSeeds: ProductSeed[] = [
  {
    handle: "futura-body-wave",
    title: "Futura Body Wave",
    subtitle: "13x4 lace front, 99J burgundy",
    description: "Soft S-shaped waves in a deep burgundy that reads almost black indoors and wine in daylight. Pre-plucked hairline with baby hair, so it sits flat out of the box.",
    collectionId: "col_futura",
    options: [
      { name: "Length", values: ['18"', '22"', '26"'] },
      { name: "Colour", values: ["99J", "1B"] },
    ],
    price: (o) => ({ '18"': 32000, '22"': 38500, '26"': 45000 })[o.Length ?? '18"'] ?? 32000,
    compareAt: (o) => (o.Length === '26"' ? 52000 : null),
    specs: [["Fibre", "Futura heat-resistant"], ["Lace", "13x4 HD lace front"], ["Cap", "Medium, adjustable straps"], ["Heat", "Up to 180°C"]],
    care: ["Detangle from the ends up with a wide-tooth comb.", "Keep heat tools below 180°C.", "Wash in cool water every 10 to 15 wears."],
    tags: ["wave", "lace front", "colour"],
    featured: true,
    createdDaysAgo: 12,
    rating: [4.7, 38],
    alt: "Burgundy 99J body wave Futura fibre",
    stockSeed: 3,
  },
  {
    handle: "futura-deep-wave-bob",
    title: "Futura Deep Wave Bob",
    subtitle: "Closure bob, natural black",
    description: "A chin-length deep wave bob with a 4x4 closure. Light on the head and quick to style, made for weekends and travel.",
    collectionId: "col_futura",
    options: [
      { name: "Length", values: ['10"', '12"'] },
      { name: "Lace", values: ["4x4 closure", "13x4 frontal"] },
    ],
    price: (o) => (o.Length === '12"' ? 27500 : 24000) + (o.Lace === "13x4 frontal" ? 6000 : 0),
    specs: [["Fibre", "Futura heat-resistant"], ["Cap", "Medium"], ["Density", "150%"]],
    care: ["Scrunch with a little mousse to refresh the waves.", "Store on a stand, not folded."],
    tags: ["bob", "wave"],
    createdDaysAgo: 30,
    rating: [4.5, 21],
    alt: "Natural black deep wave bob",
    stockSeed: 7,
  },
  {
    handle: "futura-honey-layers",
    title: "Futura Honey Layers",
    subtitle: "Layered cut, shade 27 with dark root",
    description: "Face-framing layers in honey blonde 27, melted into a darker root so it looks grown rather than placed.",
    collectionId: "col_futura",
    options: [{ name: "Length", values: ['16"', '20"', '24"'] }],
    price: (o) => ({ '16"': 34000, '20"': 39500, '24"': 44000 })[o.Length ?? '16"'] ?? 34000,
    specs: [["Fibre", "Futura heat-resistant"], ["Lace", "13x4 HD lace front"], ["Colour", "27 with 1B root"]],
    care: ["Use a heat protectant before curling.", "Avoid purple shampoo; it dulls the honey tone."],
    tags: ["layers", "colour"],
    featured: true,
    createdDaysAgo: 5,
    rating: [4.8, 14],
    alt: "Honey blonde layered wig",
    stockSeed: 11,
  },
  {
    handle: "futura-613-straight",
    title: "Futura 613 Straight",
    subtitle: "Full blonde, middle part",
    description: "Sleek platinum 613 with a soft middle part. Takes toner well if you want to customise the shade.",
    collectionId: "col_futura",
    options: [{ name: "Length", values: ['20"', '24"', '28"'] }],
    price: (o) => ({ '20"': 36000, '24"': 42000, '28"': 48500 })[o.Length ?? '20"'] ?? 36000,
    specs: [["Fibre", "Futura heat-resistant"], ["Lace", "13x4 transparent lace"], ["Colour", "613 platinum"]],
    care: ["Rinse product out fully; residue shows on blonde.", "Wrap at night to prevent tangles at the nape."],
    tags: ["straight", "colour"],
    createdDaysAgo: 45,
    rating: [4.4, 9],
    alt: "Platinum blonde 613 straight wig",
    stockSeed: 13,
  },
  {
    handle: "bone-straight-double-drawn",
    title: "Double Drawn Bone Straight",
    subtitle: "Frontal unit, 1B natural",
    description: "Vietnamese double-drawn hair, full to the very ends, on a 13x4 HD frontal that melts on every skin tone. Swings, holds a flat-iron finish for days, and lasts years with care.",
    collectionId: "col_bone",
    options: [
      { name: "Length", values: ['12"', '14"', '16"', '18"', '20"', '22"', '24"', '26"', '28"', '30"'] },
      { name: "Density", values: ["180%", "250%"] },
    ],
    price: (o) => inchPrice(165000, 28000, 12)(o) + (o.Density === "250%" ? 45000 : 0),
    compareAt: (o) => (o.Length === '30"' ? inchPrice(165000, 28000, 12)(o) + (o.Density === "250%" ? 45000 : 0) + 40000 : null),
    specs: [["Hair", "100% Vietnamese virgin"], ["Drawn", "Double drawn"], ["Lace", "13x4 HD frontal"], ["Cap", "Medium, glueless option"], ["Lifespan", "2 to 4 years with care"]],
    care: ["Wash with sulphate-free shampoo every two weeks.", "Air dry flat before straightening.", "Use a silk bonnet or scarf every night."],
    tags: ["straight", "frontal", "virgin"],
    featured: true,
    createdDaysAgo: 60,
    rating: [4.9, 112],
    alt: "Double drawn bone straight 1B frontal",
    stockSeed: 17,
  },
  {
    handle: "bone-straight-super-double",
    title: "Super Double Drawn Bundles",
    subtitle: "Three bundles with 5x5 closure",
    description: "Three matching bundles and a 5x5 closure, for a sew-in your stylist can cut to shape. Shade 2 is a soft darkest brown that blends with most natural hair.",
    collectionId: "col_bone",
    options: [
      { name: "Length", values: ['14"', '16"', '18"', '20"', '22"', '24"'] },
      { name: "Colour", values: ["1B", "2"] },
    ],
    price: inchPrice(198000, 32000, 14),
    specs: [["Hair", "100% Vietnamese virgin"], ["Drawn", "Super double drawn"], ["Includes", "3 bundles + 5x5 closure"], ["Weight", "100g per bundle"]],
    care: ["Do not bleach above level 7.", "Detangle before every wash."],
    tags: ["bundles", "straight", "virgin"],
    createdDaysAgo: 20,
    rating: [4.8, 47],
    alt: "Super double drawn bundles in shade 2",
    stockSeed: 19,
  },
  {
    handle: "bone-straight-pixie",
    title: "Bone Straight Pixie Bob",
    subtitle: "Side part, 2x6 closure",
    description: "A sharp pixie bob cut from double-drawn hair. Ready to wear with a deep side part; no stylist needed.",
    collectionId: "col_bone",
    options: [{ name: "Length", values: ['8"', '10"'] }],
    price: (o) => (o.Length === '10"' ? 118000 : 96000),
    specs: [["Hair", "100% Vietnamese virgin"], ["Lace", "2x6 deep part closure"], ["Cap", "Small to medium"]],
    care: ["Wrap the cut at night to keep the shape.", "Trim the ends every three months."],
    tags: ["bob", "straight"],
    createdDaysAgo: 9,
    rating: [4.6, 18],
    alt: "Bone straight pixie bob",
    stockSeed: 23,
  },
  {
    handle: "bone-straight-bundles",
    title: "Bone Straight Single Bundle",
    subtitle: "Shade 4, sold per bundle",
    description: "Add length or volume to an existing install. Shade 4 chestnut brown, double drawn.",
    collectionId: "col_bone",
    options: [{ name: "Length", values: ['16"', '18"', '20"', '22"', '24"', '26"'] }],
    price: inchPrice(52000, 9500, 16),
    specs: [["Hair", "100% Vietnamese virgin"], ["Weight", "100g"], ["Colour", "4 chestnut"]],
    care: ["Seal wefts if you plan to cut them."],
    tags: ["bundles", "straight"],
    createdDaysAgo: 70,
    rating: [4.7, 33],
    alt: "Chestnut brown bone straight bundle",
    stockSeed: 29,
  },
  {
    handle: "factory-kinky-curl",
    title: "Kinky Curl Factory Wig",
    subtitle: "Glueless, shade 4",
    description: "Defined kinky curls that match a blow-out natural. Glueless cap with combs and an elastic band, so it goes on in under five minutes.",
    collectionId: "col_factory",
    options: [
      { name: "Length", values: ['14"', '18"', '22"'] },
      { name: "Density", values: ["200%"] },
    ],
    price: (o) => ({ '14"': 78000, '18"': 96000, '22"': 118000 })[o.Length ?? '14"'] ?? 78000,
    specs: [["Hair", "Human hair blend"], ["Cap", "Glueless, medium"], ["Density", "200%"]],
    care: ["Refresh curls with water and leave-in conditioner.", "Never brush when dry."],
    tags: ["curly", "glueless"],
    featured: true,
    createdDaysAgo: 15,
    rating: [4.6, 52],
    alt: "Kinky curl human hair wig in chestnut",
    stockSeed: 31,
  },
  {
    handle: "factory-water-wave",
    title: "Water Wave Factory Wig",
    subtitle: "13x4 frontal, 1B",
    description: "Loose water waves with real bounce. Wear it wet-look for an evening or brush out for a softer finish.",
    collectionId: "col_factory",
    options: [{ name: "Length", values: ['18"', '22"', '26"'] }],
    price: (o) => ({ '18"': 89000, '22"': 108000, '26"': 128000 })[o.Length ?? '18"'] ?? 89000,
    specs: [["Hair", "Human hair"], ["Lace", "13x4 frontal"], ["Density", "180%"]],
    care: ["Co-wash weekly to keep the wave pattern."],
    tags: ["wave", "frontal"],
    createdDaysAgo: 25,
    rating: [4.5, 29],
    alt: "1B water wave wig",
    stockSeed: 37,
  },
  {
    handle: "factory-burgundy-bob",
    title: "Burgundy Blunt Bob",
    subtitle: "Shade 99J, middle part",
    description: "A blunt bob in deep 99J with a crisp middle part. Already cut and coloured; just install and go.",
    collectionId: "col_factory",
    options: [{ name: "Length", values: ['10"', '12"', '14"'] }],
    price: (o) => ({ '10"': 62000, '12"': 69000, '14"': 76000 })[o.Length ?? '10"'] ?? 62000,
    specs: [["Hair", "Human hair"], ["Lace", "4x4 closure"], ["Colour", "99J"]],
    care: ["Use colour-safe shampoo to slow fading."],
    tags: ["bob", "colour"],
    createdDaysAgo: 3,
    rating: [4.3, 7],
    alt: "Burgundy blunt bob",
    stockSeed: 41,
  },
  {
    handle: "factory-pixie-curl",
    title: "Pixie Curl Unit",
    subtitle: "Short tapered curls",
    description: "Tight curls tapered short at the back and fuller on top. Low maintenance and very light.",
    collectionId: "col_factory",
    options: [{ name: "Length", values: ['6"', '8"'] }],
    price: (o) => (o.Length === '8"' ? 58000 : 49500),
    specs: [["Hair", "Human hair"], ["Cap", "Glueless, small to medium"]],
    care: ["Spritz with water and finger-shape each morning."],
    tags: ["curly", "short"],
    createdDaysAgo: 50,
    rating: [4.4, 11],
    alt: "Short pixie curl unit",
    stockSeed: 43,
  },
  {
    handle: "braids-knotless-xpression",
    title: "Pre-stretched Braiding Hair",
    subtitle: "Itch-free, per pack",
    description: "Soft, pre-stretched fibre treated to reduce scalp itch. Feathered ends make knotless braids quicker to finish.",
    collectionId: "col_braids",
    options: [
      { name: "Length", values: ['26"', '30"', '36"'] },
      { name: "Colour", values: ["1B", "2", "27", "350"] },
    ],
    price: (o) => ({ '26"': 3800, '30"': 4500, '36"': 5600 })[o.Length ?? '26"'] ?? 3800,
    specs: [["Fibre", "Low-temperature kanekalon"], ["Pack", "3 bundles, 90g"], ["Ends", "Pre-feathered"]],
    care: ["Dip ends in hot water to seal.", "Foam-wash braids weekly."],
    tags: ["braids", "knotless"],
    featured: true,
    createdDaysAgo: 40,
    rating: [4.7, 204],
    alt: "Black pre-stretched braiding hair",
    stockSeed: 47,
  },
  {
    handle: "braids-french-curl",
    title: "French Curl Braids",
    subtitle: "Curled ends, shade 27",
    description: "Silky braiding hair with loose curled ends for French-curl and goddess styles.",
    collectionId: "col_braids",
    options: [
      { name: "Length", values: ['22"', '26"'] },
      { name: "Colour", values: ["1B", "27", "613"] },
    ],
    price: (o) => (o.Length === '26"' ? 6200 : 5400),
    specs: [["Fibre", "Soft yaki synthetic"], ["Pack", "150g"]],
    care: ["Separate curls with your fingers, not a comb."],
    tags: ["braids", "curly"],
    createdDaysAgo: 18,
    rating: [4.6, 61],
    alt: "Honey French curl braiding hair",
    stockSeed: 53,
  },
  {
    handle: "braids-copper-boho",
    title: "Boho Curl Human Hair Add-on",
    subtitle: "Human hair curls, shade 350",
    description: "Loose human hair curls to tuck into boho knotless braids. Copper 350 adds warmth around the face.",
    collectionId: "col_braids",
    options: [{ name: "Colour", values: ["1B", "350"] }],
    price: () => 18500,
    specs: [["Hair", "Human hair bulk"], ["Weight", "50g"]],
    care: ["Apply curl cream weekly to keep definition."],
    tags: ["braids", "boho"],
    createdDaysAgo: 7,
    rating: [4.8, 23],
    alt: "Copper boho curls",
    stockSeed: 59,
  },
  {
    handle: "care-edge-control",
    title: "All-day Edge Control",
    subtitle: "Strong hold, no flake",
    description: "Holds baby hair through heat and humidity without a white cast. Castor oil base keeps edges conditioned.",
    collectionId: "col_maintains",
    options: [{ name: "Size", values: ["100ml", "200ml"] }],
    price: (o) => (o.Size === "200ml" ? 9500 : 6000),
    specs: [["Hold", "Strong"], ["Base", "Castor oil"]],
    care: ["Apply with a clean brush; close the lid tightly."],
    tags: ["care", "edges"],
    createdDaysAgo: 80,
    rating: [4.5, 88],
    alt: "Edge control jar",
    stockSeed: 61,
  },
  {
    handle: "care-silk-bonnet",
    title: "Double-layer Silk Bonnet",
    subtitle: "Reversible, wide band",
    description: "Two layers of satin with a soft wide band that will not leave a mark on your forehead. Fits over long units.",
    collectionId: "col_maintains",
    options: [{ name: "Colour", values: ["Plum", "Honey", "Black"] }],
    price: () => 8500,
    specs: [["Fabric", "Satin, double layer"], ["Fit", "One size, wide band"]],
    care: ["Hand wash cool; dry flat."],
    tags: ["care", "bonnet"],
    createdDaysAgo: 22,
    rating: [4.8, 140],
    alt: "Satin bonnet",
    stockSeed: 67,
  },
  {
    handle: "care-wig-grip-band",
    title: "Velvet Wig Grip Band",
    subtitle: "Holds glueless units",
    description: "An adjustable velvet band that keeps glueless units in place and protects your edges from friction.",
    collectionId: "col_maintains",
    options: [{ name: "Colour", values: ["Black", "Brown", "Nude"] }],
    price: () => 4500,
    specs: [["Fabric", "Velvet"], ["Closure", "Adjustable hook and loop"]],
    care: ["Wash weekly with mild soap."],
    tags: ["care", "glueless"],
    createdDaysAgo: 35,
    rating: [4.4, 57],
    alt: "Velvet wig grip band",
    stockSeed: 71,
  },
  {
    handle: "care-revive-spray",
    title: "Unit Revive Spray",
    subtitle: "Softens and restores shine",
    description: "A light leave-in that brings back softness to units that have been washed and heat-styled many times.",
    collectionId: "col_maintains",
    options: [{ name: "Size", values: ["150ml", "300ml"] }],
    price: (o) => (o.Size === "300ml" ? 13500 : 8500),
    specs: [["Type", "Leave-in, water based"], ["Use", "Human hair and Futura"]],
    care: ["Shake well; spray from 20cm away."],
    tags: ["care", "spray"],
    createdDaysAgo: 14,
    rating: [4.6, 42],
    alt: "Revive spray bottle",
    stockSeed: 73,
  },
];
function cartesian(options: ProductOption[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (acc, opt) => acc.flatMap((combo) => opt.values.map((v) => ({ ...combo, [opt.name]: v }))),
    [{}],
  );
}

function buildProduct(seed: ProductSeed, index: number): Product {
  const id = `prod_${index + 1}`;
  const images = productImages(seed.handle, seed.alt);
  const rand = rng(seed.stockSeed);
  const combos = cartesian(seed.options);
  const variants: Variant[] = combos.map((options, vi) => {
    const roll = rand();
    const available = roll < 0.12 ? 0 : roll < 0.3 ? Math.ceil(rand() * 3) : 4 + Math.floor(rand() * 30);
    const price = n(seed.price(options));
    const compare = seed.compareAt?.(options);
    return {
      id: `var_${index + 1}_${vi + 1}`,
      productId: id,
      sku: `QLH-${seed.handle.split("-").map((p) => p[0]?.toUpperCase()).join("")}-${Object.values(options).join("-").replace(/[^A-Za-z0-9-]/g, "")}`,
      title: Object.values(options).join(" / "),
      options,
      price,
      compareAtPrice: compare ? n(compare) : null,
      availability: "in_stock",
      inventory: { tracked: true, available, policy: "deny", lowStockThreshold: 3 },
      mediaId: images[vi % images.length]?.id ?? null,
      position: vi,
    };
  });
  const typeId = TYPE_BY_HANDLE[seed.handle] ?? null;
  const attributes: Record<string, string> = {};
  for (const [label, value] of seed.specs) {
    const key = SPEC_KEY[label];
    if (key) attributes[key] = attributes[key] ? `${attributes[key]}\n${value}` : value;
  }
  if (seed.care.length) attributes[typeId === "type_care" ? "usage" : "care"] = seed.care.join("\n");
  return {
    id,
    handle: seed.handle,
    title: seed.title,
    subtitle: seed.subtitle,
    description: seed.description,
    status: "published",
    collectionIds: [seed.collectionId],
    media: images,
    options: seed.options,
    variants,
    priceRange: { min: 0, max: 0 },
    compareAtPriceRange: null,
    availability: "in_stock",
    productTypeId: typeId,
    attributes,
    video: null,
    tags: seed.tags,
    // Computed from published reviews by the backend.
    rating: { average: 0, count: 0 },
    featured: seed.featured ?? false,
    seo: {},
    createdAt: iso(seed.createdDaysAgo),
    updatedAt: iso(Math.max(0, seed.createdDaysAgo - 2)),
  };
}

export const seedProducts: Product[] = productSeeds.map(buildProduct);

/* ---------------------------------------------------------------- reviews */
// Sample reviews for demo mode. The storefront labels them as samples in mock mode.

const reviewBodies: [string, string, string, number, string][] = [
  ["Adaeze O.", "Ilesha", "Ends are as full as the top", 5, "I was worried about thin ends after my last purchase elsewhere. This one is thick all the way down and it still swings after three washes."],
  ["Temi A.", "Osogbo", "Delivered quickly", 5, "Ordered on Monday and it arrived on Wednesday. The lace was already plucked."],
  ["Chioma N.", "Ibadan", "Colour is richer in person", 4, "The burgundy is deeper than the photos. I love it but expected it a little brighter."],
  ["Hauwa B.", "Abuja", "Holds curls for days", 5, "Curled it Friday and the curls were still there on Tuesday. Light enough to wear all day at work."],
  ["Bisi K.", "Ile-Ife", "Good value for the price", 4, "Not virgin-hair soft, but for the price it is the best Futura I have tried."],
  ["Ngozi E.", "Akure", "My stylist asked where I bought it", 5, "Sewed in the bundles with the closure and my stylist kept touching it. No shedding so far."],
  ["Funke L.", "Ilesha", "Slight shedding at first", 3, "Shed a bit in the first wash, then settled down. The store answered my questions quickly."],
  ["Zainab M.", "Ilorin", "Perfect bonnet", 5, "Fits over my 26 inch unit with room to spare and the band does not slip."],
];

/** Mock-only fields: who wrote the review, so "My reviews" can find it. Never sent to the browser. */
export type MockReview = Review & { email: string | null; customerId: string | null };

const sampleReviews: MockReview[] = seedProducts.flatMap((p, pi) =>
  [0, 1, 2].map((k) => {
    const [author, location, title, rating, body] = reviewBodies[(pi + k * 3) % reviewBodies.length]!;
    const status = pi % 6 === 0 && k === 2 ? "pending" : "approved";
    return {
      id: `rev_${pi + 1}_${k + 1}`,
      productId: p.id,
      productTitle: p.title,
      productHandle: p.handle,
      author,
      location,
      rating,
      title,
      body,
      verifiedPurchase: k !== 2,
      status,
      reply: k === 0 && rating < 4 ? "Thank you for the honest review. We have passed this on." : null,
      rejectionReason: null,
      createdAt: iso(pi + k * 4, 14),
      moderatedAt: status === "approved" ? iso(Math.max(0, pi + k * 4 - 1), 10) : null,
      email: null,
      customerId: null,
    } satisfies MockReview;
  }),
);

// The demo customer's own reviews, one in each state, so the account page can show all three.
const demoCustomerReviews: MockReview[] = (["approved", "pending", "rejected"] as const).map((status, i) => {
  const p = seedProducts[i + 1]!;
  return {
    id: `rev_demo_${i + 1}`,
    productId: p.id,
    productTitle: p.title,
    productHandle: p.handle,
    author: "Demo C.",
    location: "Ilesha",
    rating: status === "rejected" ? 2 : 5,
    title: status === "approved" ? "Sample review: soft and full" : status === "pending" ? "Sample review: waiting for approval" : "Sample review: not published",
    body:
      status === "rejected"
        ? "Sample text for demo mode. Contains a phone number and a link, which the store does not publish."
        : "Sample text for demo mode. It shows how a customer's own review appears in their account.",
    verifiedPurchase: true,
    status,
    reply: null,
    rejectionReason: status === "rejected" ? "Reviews can't include phone numbers or links. You're welcome to submit it again without them." : null,
    createdAt: iso(3 + i * 2, 11),
    moderatedAt: status === "pending" ? null : iso(2 + i * 2, 9),
    email: "customer@queenluxuryhair.test",
    customerId: "cus_1",
  } satisfies MockReview;
});

export const seedReviews: MockReview[] = [...demoCustomerReviews, ...sampleReviews];

/* --------------------------------------------------------------- settings */

export const seedSettings: StoreSettings = {
  name: "Queen Luxury Hair",
  tagline: "Luxury hair, crowned for you.",
  metaDescription: "Wigs, bone straight hair, factory wigs, braid extensions and hair care. Shop online or visit Queen Luxury Hair in Ijoka, Ilesha, Osun State.",
  logo: null,
  logoDark: null,
  contactEmail: null,
  phone: null,
  whatsapp: null,
  address: STORE_ADDRESS,
  openingHours: null,
  currency: "NGN",
  branding: {
    colors: { ...DEFAULT_BRAND_COLORS },
    radius: 999,
  },
  theme: { defaultMode: "dark" },
  productPageNotes: {
    shipping: "Delivery fees and times are worked out at checkout from your state and town, before you pay. You can also collect from our store in Ijoka, Ilesha.",
    returns: "Tell us within the return window if your hair isn't right. Read the returns policy for what can be returned and how.",
  },
  social: { instagram: null, tiktok: null, facebook: null },
  announcement: { enabled: true, message: "Visit us in Ijoka, beside Ibiyemi Building Material.", href: "/contact" },
  freeShippingThreshold: null,
};

export const seedShipping: ShippingSettings = {
  processingDays: [0, 1],
  zones: [
    {
      id: "zone_ilesha",
      name: "Ilesha",
      states: ["Osun"],
      cities: ["Ilesha", "Ilesa", "Ijoka", "Ilesa East", "Ilesa West"],
      rates: [
        { id: "rate_ilesha_rider", label: "Ilesha delivery", description: "Delivered by rider within Ilesha.", amount: n(1500), etaDays: [0, 1], freeOver: null },
        { id: "rate_ilesha_pickup", label: "Pick up in store", description: "Collect from our store at Ijoka once we confirm your order is ready.", amount: 0, etaDays: [0, 1], freeOver: null },
      ],
    },
    {
      id: "zone_osun",
      name: "Rest of Osun",
      states: ["Osun"],
      cities: [],
      rates: [{ id: "rate_osun_std", label: "Osun courier", description: "Tracked delivery within Osun State.", amount: n(3000), etaDays: [1, 2], freeOver: null }],
    },
    {
      id: "zone_sw",
      name: "South West",
      states: ["Oyo", "Ondo", "Ekiti", "Ogun", "Lagos", "Kwara"],
      cities: [],
      rates: [{ id: "rate_sw_std", label: "Courier", description: "Tracked courier delivery.", amount: n(5000), etaDays: [2, 4], freeOver: null }],
    },
    {
      id: "zone_ng",
      name: "Rest of Nigeria",
      states: [],
      cities: [],
      rates: [{ id: "rate_ng_std", label: "Nationwide courier", description: "Tracked courier to your city or nearest pickup office.", amount: n(8000), etaDays: [3, 6], freeOver: null }],
    },
  ],
};

export const seedPayments: PaymentSettings = {
  paystack: { enabled: true, mode: "test", publicKey: "pk_test_replace_me" },
  flutterwave: { enabled: false, mode: "test", publicKey: "" },
  // Off until the owner enters the store's real account details in admin.
  bankTransfer: { enabled: false, bankName: "", accountName: "", accountNumber: "", instructions: "Use your order number as the transfer narration.", holdHours: 24 },
  payOnDelivery: { enabled: true, states: ["Osun"], maxOrderTotal: n(150000) },
};

/* ---------------------------------------------------------------- content */

const homepageSections: HomepageSection[] = [
  {
    id: "sec_marquee",
    type: "marquee",
    enabled: true,
    position: 0,
    items: ["Delivery across Nigeria", "Pickup in Ijoka, Ilesha", "Secure checkout", "Shades 1B to 613", "Wigs, bundles and braids"],
  },
  {
    id: "sec_hero",
    type: "hero",
    enabled: true,
    position: 0,
    heading: "Luxury hair, crowned for you.",
    body: "Wigs, bone straight, braid extensions and hair care from Ijoka, Ilesha. Delivered across Nigeria, or collect in store.",
    primaryCta: { label: "Shop the collection", href: "/collections" },
    secondaryCta: { label: "Bone straight", href: "/collections/bone-straight" },
    image: mediaById("med_hero-main"),
    layerImage: mediaById("med_hero-layer"),
    stats: [
      { source: "collections", value: 0, suffix: "", label: "Collections" },
      { source: "products", value: 0, suffix: "", label: "Styles in stock" },
      { source: "custom", value: 7, suffix: "", label: "Shade codes, 1B to 613" },
    ],
  },
  {
    id: "sec_collections",
    type: "collections",
    enabled: true,
    position: 0,
    heading: "Shop by style",
    body: "",
    collectionIds: [],
  },
  {
    id: "sec_best",
    type: "product_rail",
    enabled: true,
    position: 0,
    heading: "Best seller",
    body: "",
    source: { kind: "best_sellers" },
    limit: 8,
  },
  {
    id: "sec_promo",
    type: "promo",
    enabled: true,
    position: 0,
    heading: "10% off your first order",
    body: "Use the code at checkout on orders over ₦50,000.",
    cta: { label: "Start shopping", href: "/collections" },
    image: mediaById("med_promo-campaign"),
    code: "WELCOME10",
    endsAt: null,
    tone: "burgundy",
  },
  {
    id: "sec_featured",
    type: "product_rail",
    enabled: true,
    position: 0,
    heading: "Trending now",
    body: "",
    source: { kind: "featured" },
    limit: 8,
  },
  {
    id: "sec_trust",
    type: "promises",
    enabled: true,
    position: 0,
    items: [
      { title: "See it in store", body: "Visit us in Ijoka, Ilesha to compare textures and shades." },
      { title: "Clear prices in naira", body: "Delivery is shown at checkout before you pay." },
      { title: "Pay your way", body: "Card online, or pay on delivery where it's available." },
    ],
  },
  {
    id: "sec_story",
    type: "editorial",
    enabled: true,
    position: 0,
    heading: "A luxury hair house in the heart of Ilesha.",
    body: "Queen Luxury Hair is in Ijoka, beside Ibiyemi Building Material. Come in to see textures and shades in person, or shop here and have your order delivered.",
    image: mediaById("med_editorial-store"),
    cta: { label: "Find the store", href: "/contact" },
    imageSide: "left",
  },
  {
    id: "sec_new",
    type: "product_rail",
    enabled: true,
    position: 0,
    heading: "New arrivals",
    body: "",
    source: { kind: "newest" },
    limit: 8,
  },
  {
    id: "sec_quality",
    type: "editorial",
    enabled: true,
    position: 0,
    heading: "Double drawn means full to the very end.",
    body: "In double-drawn hair, the shorter strands are removed so the ends are nearly as thick as the root. A long unit keeps its fullness instead of thinning out at the bottom.",
    image: mediaById("med_editorial-bone-straight"),
    cta: { label: "Shop bone straight", href: "/collections/bone-straight" },
    imageSide: "right",
  },
  {
    id: "sec_shades",
    type: "shade_guide",
    enabled: true,
    position: 0,
    heading: "Find your shade",
    body: "Shade codes are shared across the hair industry, so you can match what your stylist asks for.",
    shades: [
      { code: "1B", name: "Off black", hex: "#1E1614" },
      { code: "2", name: "Darkest brown", hex: "#2C1D16" },
      { code: "4", name: "Chestnut", hex: "#4A2F22" },
      { code: "99J", name: "Burgundy", hex: "#5C1A2A" },
      { code: "350", name: "Copper", hex: "#A5482A" },
      { code: "27", name: "Honey blonde", hex: "#B47B3A" },
      { code: "613", name: "Platinum", hex: "#E3C58F" },
    ],
  },
  {
    id: "sec_testimonials",
    type: "testimonials",
    enabled: true,
    position: 0,
    heading: "What customers say",
    items: [
      { id: "t1", quote: "The bone straight is full from top to bottom. I'll be back for a longer length.", name: "Sample customer", location: "Ilesha" },
      { id: "t2", quote: "I could see the shades in store before I chose. The 27 is exactly what I wanted.", name: "Sample customer", location: "Osogbo" },
      { id: "t3", quote: "My braiding hair arrived well packed and wasn't itchy at all.", name: "Sample customer", location: "Ibadan" },
    ],
  },
  {
    id: "sec_reviews",
    type: "reviews",
    enabled: true,
    position: 0,
    heading: "Recent product reviews",
  },
  {
    id: "sec_care",
    type: "care_tips",
    enabled: true,
    position: 0,
    heading: "Make every install last",
    body: "A few habits keep wigs and bundles soft and full for longer.",
    tips: [
      { title: "Sleep in satin", body: "A satin bonnet or scarf stops friction that causes tangles and frizz." },
      { title: "Wash gently", body: "Use sulphate-free shampoo and cool water, and condition from mid-length down." },
      { title: "Keep heat moderate", body: "Use a heat protectant and stay below 180°C on Futura and human hair." },
    ],
    cta: { label: "Read the care guide", href: "/hair-care" },
  },
  {
    id: "sec_faq",
    type: "faq",
    enabled: true,
    position: 0,
    heading: "Questions, answered",
    limit: 4,
  },
  {
    id: "sec_newsletter",
    type: "newsletter",
    enabled: true,
    position: 0,
    heading: "New arrivals, first",
    body: "Get an email when new textures and shades arrive. No spam.",
  },
  {
    id: "sec_cta",
    type: "cta_band",
    enabled: true,
    position: 0,
    heading: "Not sure which length or density suits you?",
    body: "Send us a message with the look you want and we'll help you choose.",
    cta: { label: "Ask us", href: "/contact" },
    whatsapp: true,
  },

];

/** Positions follow array order. */
export const seedHomepage: HomepageSection[] = homepageSections.map((s, i) => ({ ...s, position: i }));

export const seedNavigation: Navigation = {
  main: [
    {
      id: "nav_shop",
      label: "Shop",
      href: "/collections",
      children: [
        { id: "nav_c1", label: "Futura Wig", href: "/collections/futura-wig" },
        { id: "nav_c2", label: "Bone Straight", href: "/collections/bone-straight" },
        { id: "nav_c3", label: "Factory Wigs", href: "/collections/factory-wigs" },
        { id: "nav_c4", label: "Braids Extensions", href: "/collections/braids-extensions" },
        { id: "nav_c5", label: "Hair Maintains", href: "/collections/hair-maintains" },
      ],
    },
    { id: "nav_new", label: "New arrivals", href: "/search?sort=newest" },
    { id: "nav_care", label: "Hair care", href: "/hair-care" },
    { id: "nav_about", label: "About", href: "/about" },
    { id: "nav_contact", label: "Contact", href: "/contact" },
  ],
  footer: [
    {
      id: "foot_shop",
      title: "Shop",
      items: [
        { id: "f1", label: "All collections", href: "/collections" },
        { id: "f2", label: "Bone Straight", href: "/collections/bone-straight" },
        { id: "f3", label: "Futura Wig", href: "/collections/futura-wig" },
        { id: "f4", label: "Hair Maintains", href: "/collections/hair-maintains" },
      ],
    },
    {
      id: "foot_help",
      title: "Help",
      items: [
        { id: "f5", label: "Track an order", href: "/track" },
        { id: "f6", label: "Shipping policy", href: "/shipping" },
        { id: "f7", label: "Returns and refunds", href: "/returns" },
        { id: "f8", label: "FAQs", href: "/faq" },
        { id: "f9", label: "Contact us", href: "/contact" },
      ],
    },
    {
      id: "foot_about",
      title: "Queen Luxury Hair",
      items: [
        { id: "f10", label: "About us", href: "/about" },
        { id: "f11", label: "Hair care guide", href: "/hair-care" },
        { id: "f12", label: "Privacy policy", href: "/privacy" },
        { id: "f13", label: "Terms", href: "/terms" },
      ],
    },
  ],
};

/* Pages ship as starter drafts (reviewed: false). The owner edits and confirms them in admin → Pages. */
export const seedPages: ContentPage[] = [
  {
    slug: "about",
    title: "About Queen Luxury Hair",
    intro: "A hair and beauty store in Ijoka, Ilesha, Osun State, selling wigs, bundles, braiding hair and hair care.",
    blocks: [
      { kind: "heading", text: "What we sell" },
      { kind: "list", items: ["Futura wigs: heat-friendly fibre in waves, bobs and colours.", "Bone straight: double-drawn bundles and frontal units.", "Factory wigs: ready-to-wear human hair units.", "Braids extensions: pre-stretched braiding hair and curly add-ons.", "Hair maintains: edge control, bonnets, grips and sprays."] },
      { kind: "heading", text: "Visit the store" },
      { kind: "paragraph", text: `You'll find us at ${STORE_ADDRESS}.` },
    ],
    reviewed: false,
    updatedAt: iso(3),
  },
  {
    slug: "hair-care",
    title: "Hair care guide",
    intro: "How to wash, store and refresh each kind of hair, so your install lasts.",
    blocks: [
      { kind: "heading", text: "Bone straight and human hair" },
      { kind: "list", items: ["Wash with a sulphate-free shampoo when it feels heavy, usually every one to two weeks.", "Condition from mid-length to ends only, keeping product off the lace.", "Let it air dry flat on a towel, then straighten on medium heat with a protectant.", "Sleep in a satin bonnet or wrap."] },
      { kind: "heading", text: "Futura fibre" },
      { kind: "list", items: ["Use cool water; hot water relaxes the curl pattern.", "Keep curling irons and straighteners below 180°C.", "Store it on a stand to keep its shape."] },
      { kind: "heading", text: "Braids" },
      { kind: "list", items: ["Foam-wash your scalp with diluted shampoo.", "Oil the scalp lightly, not the braids.", "Take braids out in good time to protect your edges."] },
      { kind: "heading", text: "Refreshing an older unit" },
      { kind: "paragraph", text: "Deep condition for 30 minutes under a shower cap, rinse with cool water and finish with a light leave-in. If the ends are dry and split, a small trim brings back a clean line." },
    ],
    reviewed: false,
    updatedAt: iso(3),
  },
  {
    slug: "faq",
    title: "Frequently asked questions",
    intro: "Quick answers about ordering, delivery and choosing hair.",
    blocks: [
      { kind: "qa", question: "How much is delivery and how long does it take?", answer: "It depends on your state and town. Enter your address at checkout to see every delivery option, its fee and the expected time before you pay." },
      { kind: "qa", question: "Can I pick up my order?", answer: `Yes. Choose "Pick up in store" at checkout if you're in Ilesha, and collect from ${STORE_ADDRESS} once we confirm it's ready.` },
      { kind: "qa", question: "Can I pay on delivery?", answer: "Pay on delivery is offered in some areas and up to a set order value. If it's available for your address, you'll see it as a payment option at checkout." },
      { kind: "qa", question: "How is hair length measured?", answer: "Lengths are measured straight from the top of the unit to the ends, even for curly textures." },
      { kind: "qa", question: "What does density mean?", answer: "Density describes how full a unit is. 150% looks natural, 180% is full, and 250% is very full." },
      { kind: "qa", question: "How do I track my order?", answer: "Use the Track order page with your order number and the email you used at checkout." },
    ],
    reviewed: false,
    updatedAt: iso(3),
  },
  {
    slug: "shipping",
    title: "Shipping policy",
    intro: "How we deliver orders, and what to expect.",
    blocks: [
      { kind: "heading", text: "Where we deliver" },
      { kind: "paragraph", text: "We deliver within Ilesha, across Osun State and to other states in Nigeria. The options for your address, with fees and estimated times, are shown at checkout." },
      { kind: "heading", text: "Pickup" },
      { kind: "paragraph", text: `Customers in Ilesha can collect from ${STORE_ADDRESS}. We'll confirm when your order is ready.` },
      { kind: "heading", text: "Processing" },
      { kind: "paragraph", text: "Orders are prepared after payment is confirmed, or after we confirm a pay-on-delivery order with you." },
    ],
    reviewed: false,
    updatedAt: iso(3),
  },
  {
    slug: "returns",
    title: "Returns and refunds",
    intro: "If something isn't right with your order, contact us and we'll help.",
    blocks: [
      { kind: "heading", text: "What can be returned" },
      { kind: "list", items: ["Unworn, unwashed hair with the lace uncut and any bands still attached.", "Unopened packs of braiding hair.", "Opened care products can't be returned for hygiene reasons.", "Hair that has been cut or coloured on request is final sale."] },
      { kind: "heading", text: "How to start a return" },
      { kind: "paragraph", text: "Contact us with your order number and photos of the item. Once we approve the return, bring it to the store or send it back by courier. Approved refunds go back to your original payment method." },
    ],
    reviewed: false,
    updatedAt: iso(3),
  },
  {
    slug: "privacy",
    title: "Privacy policy",
    intro: "What personal information we collect and how we use it, in line with the Nigeria Data Protection Act 2023.",
    blocks: [
      { kind: "heading", text: "What we collect" },
      { kind: "paragraph", text: "Your name, contact details and delivery address when you place an order, messages you send us, and basic information about how the site is used." },
      { kind: "heading", text: "How we use it" },
      { kind: "paragraph", text: "To process and deliver orders, answer your questions and, if you opt in, send occasional updates. We don't sell your information." },
      { kind: "heading", text: "Payments" },
      { kind: "paragraph", text: "Card payments are handled by our payment provider. We never see or store your full card details." },
      { kind: "heading", text: "Your rights" },
      { kind: "paragraph", text: "You can ask for a copy of the information we hold about you, or ask us to correct or delete it, by contacting us." },
    ],
    reviewed: false,
    updatedAt: iso(3),
  },
  {
    slug: "terms",
    title: "Terms of sale",
    intro: "These terms apply to orders placed on this website.",
    blocks: [
      { kind: "paragraph", text: "Prices are shown in Nigerian naira. The total you pay, including delivery, is confirmed at checkout." },
      { kind: "paragraph", text: "An order is accepted once payment is confirmed, or once we confirm a pay-on-delivery order with you." },
      { kind: "paragraph", text: "Colours can look slightly different on different screens. Hair lengths are measured straight." },
      { kind: "paragraph", text: "Returns are covered by our returns and refunds policy." },
    ],
    reviewed: false,
    updatedAt: iso(3),
  },
];

/* --------------------------------------------------------------- discounts */

export const seedDiscounts: Discount[] = [
  {
    id: "disc_welcome",
    code: "WELCOME10",
    title: "10% off first order",
    kind: "percentage",
    value: 10,
    minSubtotal: n(50000),
    appliesTo: { type: "all" },
    startsAt: iso(90),
    endsAt: null,
    usageLimit: null,
    usageCount: 0,
    oncePerCustomer: true,
    status: "active",
  },
  {
    id: "disc_braids",
    code: "BRAIDDAY",
    title: "₦2,000 off braids",
    kind: "fixed_amount",
    value: n(2000),
    minSubtotal: n(15000),
    appliesTo: { type: "collections", ids: ["col_braids"] },
    startsAt: iso(10),
    endsAt: iso(-20),
    usageLimit: 200,
    usageCount: 0,
    oncePerCustomer: false,
    status: "active",
  },
  {
    id: "disc_ship",
    code: "FREESHIP",
    title: "Free delivery, December",
    kind: "free_shipping",
    value: 0,
    minSubtotal: n(100000),
    appliesTo: { type: "all" },
    startsAt: iso(-36),
    endsAt: iso(-66),
    usageLimit: null,
    usageCount: 0,
    oncePerCustomer: false,
    status: "scheduled",
  },
];

/* ---------------------------------------------------------------- inquiries */

export const seedInquiries: Inquiry[] = [
  { id: "inq_1", name: "Sample customer", email: "customer1@example.com", phone: null, topic: "order", orderNumber: "QLH-10412", message: "Hello, is my order ready for pickup at the store?", status: "new", replies: [], createdAt: iso(0, 9) },
  { id: "inq_2", name: "Sample customer", email: "customer2@example.com", phone: null, topic: "product", orderNumber: null, message: "Do you have the 26 inch bone straight in 250% density with a closure instead of a frontal?", status: "open", replies: [{ id: "rep_1", author: "Demo Manager", body: "We can check with our supplier and get back to you.", createdAt: iso(1, 12) }], createdAt: iso(1, 10) },
  { id: "inq_3", name: "Sample customer", email: "customer3@example.com", phone: null, topic: "wholesale", orderNumber: null, message: "I run a salon in Osogbo and want to order braiding hair every month. Do you offer wholesale prices?", status: "new", replies: [], createdAt: iso(2, 15) },
];

/* ------------------------------------------------------------- staff/roles */

export const seedRoles: Role[] = [
  { id: "role_owner", name: "Owner", description: "Full access, including staff and payment settings.", permissions: [
    "dashboard:read", "products:read", "products:write", "collections:write", "inventory:write", "media:write", "orders:read", "orders:write", "orders:refund", "customers:read", "content:write", "discounts:write", "reviews:moderate", "inquiries:respond", "analytics:read", "settings:write", "staff:manage",
  ], system: true },
  { id: "role_manager", name: "Store manager", description: "Runs the catalog, content, customers and orders. No staff or payment settings.", permissions: [
    "dashboard:read", "products:read", "products:write", "collections:write", "inventory:write", "media:write", "orders:read", "orders:write", "customers:read", "content:write", "discounts:write", "reviews:moderate", "inquiries:respond", "analytics:read",
  ], system: false },
  { id: "role_fulfilment", name: "Fulfilment", description: "Packs and ships orders, updates stock, answers messages.", permissions: ["dashboard:read", "products:read", "orders:read", "orders:write", "customers:read", "inventory:write", "inquiries:respond"], system: false },
];

export const seedStaff: Staff[] = [
  { id: "staff_owner", name: "Demo Owner", email: "owner@queenluxuryhair.test", roleId: "role_owner", status: "active", lastActiveAt: iso(0, 8) },
  { id: "staff_manager", name: "Demo Manager", email: "manager@queenluxuryhair.test", roleId: "role_manager", status: "active", lastActiveAt: iso(0, 7) },
  { id: "staff_fulfil", name: "Demo Fulfilment", email: "fulfilment@queenluxuryhair.test", roleId: "role_fulfilment", status: "active", lastActiveAt: iso(1, 16) },
];

/**
 * Mock-only sign-in passwords. The live backend must store salted hashes (argon2id) and
 * never return them. These exist so the permission-aware admin UI can be exercised locally.
 */
export const seedStaffPasswords: Record<string, string> = {
  "owner@queenluxuryhair.test": "demo-owner",
  "manager@queenluxuryhair.test": "demo-manager",
  "fulfilment@queenluxuryhair.test": "demo-fulfilment",
};

export const seedCustomerAddresses: SavedAddress[] = [
  { id: "addr_1", label: "Home", isDefault: true, firstName: "Demo", lastName: "Customer", phone: "08000000000", line1: "Sample Street", city: "Ilesha", state: "Osun", country: "NG" },
];

export const seedCustomer = {
  customer: { id: "cus_1", firstName: "Demo", lastName: "Customer", email: "customer@queenluxuryhair.test", phone: null as string | null, createdAt: iso(120) },
  password: "demo-customer",
};
