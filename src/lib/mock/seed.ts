/**
 * Initial data for mock mode. This is SEED data, loaded into the mock database once per
 * server process; nothing in the UI imports it directly. The Fastify backend should seed
 * PostgreSQL with equivalent rows (see docs/BACKEND_INTEGRATION.md).
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
  Review,
  Role,
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
  media("hero-main", "Close study of glossy 1B deep-wave hair against a plum backdrop", ["hero"], 1920, 1200),
  media("hero-layer", "Honey blonde 613 body wave strands", ["hero"]),
  media("editorial-bone-straight", "Straight 1B strands falling in parallel", ["editorial"], 1920, 1200),
  media("editorial-care", "Hair care products on a pale shelf", ["editorial", "care"], 1920, 1200),
  media("editorial-studio", "Copper wave strands on indigo", ["editorial"]),
  media("collection-futura-wig", "Burgundy 99J Futura fibre waves", ["collection"]),
  media("collection-bone-straight", "Sleek 1B bone straight hair", ["collection"]),
  media("collection-factory-wigs", "Kinky curl texture in natural brown", ["collection"]),
  media("collection-braids-extensions", "Long knotless braids", ["collection"]),
  media("collection-hair-maintains", "Edge control, oil and spray bottles", ["collection", "care"]),
];

const productImages = (handle: string, alt: string) =>
  [1, 2, 3].map((i) => {
    const m = media(`${handle}-${i}`, i === 1 ? alt : `${alt}, view ${i}`, ["product", handle]);
    seedMedia.push(m);
    return m;
  });

/* ------------------------------------------------------------ collections */

const collectionImage = (handle: string) => seedMedia.find((m) => m.id === `med_collection-${handle}`) ?? null;

export const seedCollections: Collection[] = [
  {
    id: "col_futura",
    handle: "futura-wig",
    title: "Futura Wig",
    summary: "Heat-friendly Futura fibre with the movement of human hair.",
    description:
      "Futura is a premium heat-resistant fibre that holds curls, waves and colour without the price of virgin hair. Each unit is pre-plucked and ready to install, so it is the easiest way to try a new shade or length.",
    image: collectionImage("futura-wig"),
    status: "published",
    position: 0,
    productCount: 0,
    seo: { title: "Futura wigs", description: "Heat-friendly Futura fibre wigs in waves, bobs and colours." },
    updatedAt: iso(3),
  },
  {
    id: "col_bone",
    handle: "bone-straight",
    title: "Bone Straight",
    summary: "Double-drawn Vietnamese hair, thick from root to tip.",
    description:
      "Our bone straight hair is double drawn, so every strand runs the full length and the ends stay as full as the top. Choose bundles to sew in or a frontal unit ready to wear, from 10 inches to 30.",
    image: collectionImage("bone-straight"),
    status: "published",
    position: 1,
    productCount: 0,
    seo: { title: "Bone straight hair", description: "Double-drawn bone straight bundles and frontal wigs, 10 to 30 inches." },
    updatedAt: iso(2),
  },
  {
    id: "col_factory",
    handle: "factory-wigs",
    title: "Factory Wigs",
    summary: "Ready-made human hair units at direct-from-factory prices.",
    description:
      "Factory wigs are fully constructed human hair units made in batches, which keeps the price honest. Textures change with each shipment, so popular lengths sell quickly.",
    image: collectionImage("factory-wigs"),
    status: "published",
    position: 2,
    productCount: 0,
    seo: { title: "Factory wigs", description: "Human hair factory wigs in curls, waves and bobs." },
    updatedAt: iso(5),
  },
  {
    id: "col_braids",
    handle: "braids-extensions",
    title: "Braids Extensions",
    summary: "Pre-stretched braiding hair that is soft on the scalp.",
    description:
      "Pre-stretched, itch-free braiding hair for knotless, box and boho styles. Sold per pack; most full heads need six to eight packs.",
    image: collectionImage("braids-extensions"),
    status: "published",
    position: 3,
    productCount: 0,
    seo: { title: "Braid extensions", description: "Pre-stretched braid extensions for knotless and boho braids." },
    updatedAt: iso(6),
  },
  {
    id: "col_maintains",
    handle: "hair-maintains",
    title: "Hair Maintains",
    summary: "What keeps a unit looking new: edge control, bonnets, sprays.",
    description:
      "Everything between installs: hold for your edges, satin to sleep in, and sprays that bring back softness and shine. Products we use on our own units.",
    image: collectionImage("hair-maintains"),
    status: "published",
    position: 4,
    productCount: 0,
    seo: { title: "Hair care and maintenance", description: "Edge control, silk bonnets, wig grips and revive sprays." },
    updatedAt: iso(8),
  },
];

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
    description: "Our signature unit. Vietnamese double-drawn hair, full to the very ends, on a 13x4 HD frontal that melts on every skin tone. Swings, holds a flat-iron finish for days, and lasts years with care.",
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
    description: "Holds baby hair through Lagos humidity without a white cast. Castor oil base keeps edges conditioned.",
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
      sku: `IR-${seed.handle.split("-").map((p) => p[0]?.toUpperCase()).join("")}-${Object.values(options).join("-").replace(/[^A-Za-z0-9-]/g, "")}`,
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
    specs: seed.specs.map(([label, value]) => ({ label, value })),
    careNotes: seed.care,
    tags: seed.tags,
    rating: { average: seed.rating[0], count: seed.rating[1] },
    featured: seed.featured ?? false,
    seo: {},
    createdAt: iso(seed.createdDaysAgo),
    updatedAt: iso(Math.max(0, seed.createdDaysAgo - 2)),
  };
}

export const seedProducts: Product[] = productSeeds.map(buildProduct);

/* ---------------------------------------------------------------- reviews */

const reviewBodies: [string, string, string, number, string][] = [
  ["Adaeze O.", "Lekki", "Ends are as full as the top", 5, "I was worried about thin ends after my last vendor. This one is thick all the way down and it still swings after three washes."],
  ["Temi A.", "Ibadan", "Arrived in two days", 5, "Ordered on Monday, rider called Wednesday morning. Lace was already bleached and plucked."],
  ["Chioma N.", "Enugu", "Colour is richer in person", 4, "The burgundy is deeper than the photos. I love it but expected it a little brighter."],
  ["Hauwa B.", "Abuja", "Holds curls for days", 5, "Curled it Friday and the curls were still there on Tuesday. Light enough to wear all day at work."],
  ["Bisi K.", "Surulere", "Good value for the price", 4, "Not virgin-hair soft, but for the price it is the best Futura I have tried."],
  ["Ngozi E.", "Port Harcourt", "My stylist asked where I bought it", 5, "Sewed in the bundles with the closure and my stylist kept touching it. No shedding so far."],
  ["Funke L.", "Ikeja", "Slight shedding at first", 3, "Shed a bit in the first wash, then settled down. Customer care replied quickly on WhatsApp."],
  ["Zainab M.", "Kano", "Perfect bonnet", 5, "Fits over my 26 inch unit with room to spare and the band does not slip."],
];

export const seedReviews: Review[] = seedProducts.flatMap((p, pi) =>
  [0, 1, 2].map((k) => {
    const [author, location, title, rating, body] = reviewBodies[(pi + k * 3) % reviewBodies.length]!;
    return {
      id: `rev_${pi + 1}_${k + 1}`,
      productId: p.id,
      productTitle: p.title,
      author,
      location,
      rating,
      title,
      body,
      verifiedPurchase: k !== 2,
      status: pi % 6 === 0 && k === 2 ? "pending" : "published",
      reply: k === 0 && rating < 4 ? "Thank you for the honest review. We have shared this with our colour team." : null,
      createdAt: iso(pi + k * 4, 14),
    } satisfies Review;
  }),
);

/* --------------------------------------------------------------- settings */

export const seedSettings: StoreSettings = {
  name: "Ìrun",
  tagline: "Hair, made to last.",
  logo: null,
  contactEmail: "hello@irun.example",
  phone: "+234 800 000 0000",
  whatsapp: "+234 800 000 0000",
  address: "Admiralty Way, Lekki Phase 1, Lagos",
  currency: "NGN",
  branding: {
    colors: { background: "#0B0709", panel: "#161015", primary: "#FF4F9A", highlight: "#D8B25A", soft: "#F6B3CF" },
    radius: 999,
  },
  social: { instagram: "https://instagram.com/", tiktok: "https://tiktok.com/", facebook: null },
  announcement: { enabled: true, message: "Same-day dispatch in Lagos on orders placed before 1pm.", href: "/shipping" },
  freeShippingThreshold: n(250000),
};

export const seedShipping: ShippingSettings = {
  processingDays: [0, 1],
  zones: [
    {
      id: "zone_lagos",
      name: "Lagos",
      states: ["Lagos"],
      rates: [
        { id: "rate_lagos_std", label: "Lagos dispatch rider", description: "Delivered by our rider, Monday to Saturday.", amount: n(3500), etaDays: [1, 2], freeOver: n(250000) },
        { id: "rate_lagos_express", label: "Same-day Lagos", description: "Order before 1pm for delivery today.", amount: n(7500), etaDays: [0, 0], freeOver: null },
        { id: "rate_lagos_pickup", label: "Pick up in Lekki", description: "Collect from our studio after we confirm by SMS.", amount: 0, etaDays: [0, 1], freeOver: null },
      ],
    },
    {
      id: "zone_sw",
      name: "South West and Abuja",
      states: ["Ogun", "Oyo", "Osun", "Ondo", "Ekiti", "FCT - Abuja"],
      rates: [{ id: "rate_sw_std", label: "Courier", description: "Tracked courier delivery.", amount: n(6000), etaDays: [2, 3], freeOver: n(400000) }],
    },
    {
      id: "zone_ng",
      name: "Rest of Nigeria",
      states: [],
      rates: [{ id: "rate_ng_std", label: "Nationwide courier", description: "Tracked courier to your city or nearest office.", amount: n(8500), etaDays: [3, 5], freeOver: null }],
    },
  ],
};

export const seedPayments: PaymentSettings = {
  paystack: { enabled: true, mode: "test", publicKey: "pk_test_replace_me" },
  flutterwave: { enabled: false, mode: "test", publicKey: "" },
  bankTransfer: {
    enabled: true,
    bankName: "Demo Bank",
    accountName: "Irun Hair Ltd (demo)",
    accountNumber: "0000000000",
    instructions: "Use your order number as the transfer narration. We confirm transfers within 2 working hours.",
    holdHours: 24,
  },
  payOnDelivery: { enabled: true, states: ["Lagos"], maxOrderTotal: n(150000) },
};

/* ---------------------------------------------------------------- content */

const mediaById = (id: string) => seedMedia.find((m) => m.id === id) ?? null;

const homepageSections: HomepageSection[] = [
  {
    id: "sec_hero",
    type: "hero",
    enabled: true,
    position: 0,
    heading: "Hair that turns heads long after the install.",
    body: "Double-drawn bone straight, Futura units and braiding hair, chosen strand by strand in Lagos and delivered nationwide.",
    primaryCta: { label: "Shop bone straight", href: "/collections/bone-straight" },
    secondaryCta: { label: "See all collections", href: "/collections" },
    image: mediaById("med_hero-main"),
    layerImage: mediaById("med_hero-layer"),
    stats: [
      { value: 37, suffix: "", label: "States we deliver to, FCT included" },
      { value: 7, suffix: "-day", label: "Returns on unworn hair" },
      { value: 24, suffix: "h", label: "Lagos dispatch on paid orders" },
    ],
  },
  {
    id: "sec_marquee",
    type: "marquee",
    enabled: true,
    position: 0,
    items: ["Double drawn bone straight", "Same-day Lagos delivery", "Futura heat-friendly wigs", "Shades 1B to 613", "Knotless braiding hair", "Pay on delivery in Lagos", "HD lace that melts"],
  },
  {
    id: "sec_collections",
    type: "collections",
    enabled: true,
    position: 1,
    heading: "Shop by collection",
    body: "From full frontal units to the bonnet you sleep in.",
    collectionIds: [],
  },
  {
    id: "sec_featured",
    type: "product_rail",
    enabled: true,
    position: 2,
    heading: "Most requested this month",
    body: "The units our stylists reorder most.",
    source: { kind: "featured" },
    limit: 4,
  },
  {
    id: "sec_editorial",
    type: "editorial",
    enabled: true,
    position: 3,
    heading: "Double drawn means full to the very end.",
    body: "Single-drawn hair tapers as short strands fall away. We remove them by hand, so a 26 inch unit is as thick at the ends as at the root. It costs more to make, and it is why our bone straight still swings in its second year.",
    image: mediaById("med_editorial-bone-straight"),
    cta: { label: "Shop double drawn", href: "/products/bone-straight-double-drawn" },
    imageSide: "right",
  },
  {
    id: "sec_shades",
    type: "shade_guide",
    enabled: true,
    position: 4,
    heading: "Find your shade",
    body: "Shade codes are the same across the industry, so you can match what your stylist asks for.",
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
    id: "sec_new",
    type: "product_rail",
    enabled: true,
    position: 5,
    heading: "Just landed",
    body: "New textures from this week's shipment.",
    source: { kind: "newest" },
    limit: 4,
  },
  {
    id: "sec_reviews",
    type: "reviews",
    enabled: true,
    position: 6,
    heading: "From customers in Lagos, Abuja and beyond",
  },
  {
    id: "sec_care",
    type: "editorial",
    enabled: true,
    position: 7,
    heading: "Care is half the unit.",
    body: "A bonnet, a sulphate-free wash and a light revive spray add months to any install. Our care guide walks you through washing, storing and reviving each hair type.",
    image: mediaById("med_editorial-care"),
    cta: { label: "Read the care guide", href: "/hair-care" },
    imageSide: "left",
  },
  {
    id: "sec_cta",
    type: "cta_band",
    enabled: true,
    position: 8,
    heading: "Not sure which length or density suits you?",
    body: "Send us a photo of your hairline and the look you want. A stylist replies on WhatsApp, usually within the hour.",
    cta: { label: "Chat with a stylist", href: "/contact" },
    whatsapp: true,
  },
  {
    id: "sec_promises",
    type: "promises",
    enabled: true,
    position: 8,
    items: [
      { title: "Checked before it ships", body: "Every unit is washed, measured and photographed before dispatch." },
      { title: "Seven-day returns", body: "Unworn hair with lace uncut can come back within seven days." },
      { title: "Pay how you prefer", body: "Card, bank transfer, or pay on delivery within Lagos." },
    ],
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
        { id: "nav_c1", label: "Bone Straight", href: "/collections/bone-straight" },
        { id: "nav_c2", label: "Futura Wig", href: "/collections/futura-wig" },
        { id: "nav_c3", label: "Factory Wigs", href: "/collections/factory-wigs" },
        { id: "nav_c4", label: "Braids Extensions", href: "/collections/braids-extensions" },
        { id: "nav_c5", label: "Hair Maintains", href: "/collections/hair-maintains" },
      ],
    },
    { id: "nav_care", label: "Hair care", href: "/hair-care" },
    { id: "nav_about", label: "About", href: "/about" },
    { id: "nav_track", label: "Track order", href: "/track" },
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
        { id: "f6", label: "Shipping", href: "/shipping" },
        { id: "f7", label: "Returns", href: "/returns" },
        { id: "f8", label: "FAQs", href: "/faq" },
        { id: "f9", label: "Contact us", href: "/contact" },
      ],
    },
    {
      id: "foot_about",
      title: "Ìrun",
      items: [
        { id: "f10", label: "About us", href: "/about" },
        { id: "f11", label: "Hair care guide", href: "/hair-care" },
        { id: "f12", label: "Privacy", href: "/privacy" },
        { id: "f13", label: "Terms", href: "/terms" },
      ],
    },
  ],
};

export const seedPages: ContentPage[] = [
  {
    slug: "about",
    title: "About Ìrun",
    intro: "Ìrun means hair in Yoruba. We started in a Lekki apartment in 2019, buying bundles one at a time and returning anything that shed in the first wash.",
    blocks: [
      { kind: "paragraph", text: "Today we work with two factories in Vietnam and one in China, and we still check every unit by hand in Lagos before it ships. We measure length, wash it once, and photograph it under the same light, so what you see is what arrives." },
      { kind: "heading", text: "What we stand for" },
      { kind: "list", items: ["Honest lengths, measured straight, never stretched.", "Shade codes that match what your stylist expects.", "Clear prices in naira, with no surprise charges at checkout."] },
      { kind: "paragraph", text: "Our studio in Lekki is open for pickups Monday to Saturday, 10am to 6pm." },
    ],
    updatedAt: iso(30),
  },
  {
    slug: "hair-care",
    title: "Hair care guide",
    intro: "How to wash, store and revive each kind of hair we sell, so your unit lasts as long as it should.",
    blocks: [
      { kind: "heading", text: "Bone straight and virgin hair" },
      { kind: "list", items: ["Wash every two weeks with a sulphate-free shampoo.", "Condition from mid-length to ends only, never the lace.", "Air dry flat on a towel, then straighten on medium heat with protectant.", "Sleep in a satin bonnet or wrap."] },
      { kind: "heading", text: "Futura fibre" },
      { kind: "list", items: ["Use cool water; hot water relaxes the curl pattern.", "Keep curling irons and straighteners below 180°C.", "Store on a stand to keep the shape."] },
      { kind: "heading", text: "Braids" },
      { kind: "list", items: ["Foam-wash your scalp weekly with diluted shampoo.", "Oil the scalp lightly, not the braids.", "Take braids out within eight weeks to protect your edges."] },
      { kind: "heading", text: "Reviving an older unit" },
      { kind: "paragraph", text: "Deep condition for 30 minutes under a shower cap, rinse cool, and finish with a light leave-in. If the ends are dry and split, a small trim brings back the line." },
    ],
    updatedAt: iso(12),
  },
  {
    slug: "faq",
    title: "Frequently asked questions",
    intro: "Quick answers about orders, hair, and delivery. Can't find yours? Message us on WhatsApp.",
    blocks: [
      { kind: "qa", question: "How long does delivery take?", answer: "Lagos orders arrive in one to two working days, or same day if you order before 1pm and choose same-day delivery. Other states take two to five working days." },
      { kind: "qa", question: "Is the length measured straight?", answer: "Yes. We measure every unit straight from the top of the lace to the ends, even for curly textures." },
      { kind: "qa", question: "What does 180% density mean?", answer: "Density describes how full the unit is. 150% is natural, 180% is full, and 250% is very full and glamorous." },
      { kind: "qa", question: "Can I pay on delivery?", answer: "Pay on delivery is available within Lagos for orders up to ₦150,000. Our rider accepts transfer or POS." },
      { kind: "qa", question: "Do you install wigs?", answer: "Yes, our Lekki studio offers installs by appointment. Contact us to book." },
      { kind: "qa", question: "Can I return hair?", answer: "Unworn hair with the lace uncut and the bands still on can be returned within seven days. See our returns policy for details." },
    ],
    updatedAt: iso(10),
  },
  {
    slug: "shipping",
    title: "Shipping",
    intro: "We ship to every state in Nigeria. Delivery fees are calculated at checkout from your state and city.",
    blocks: [
      { kind: "heading", text: "Lagos" },
      { kind: "paragraph", text: "Our riders deliver Monday to Saturday. Same-day delivery is available for orders placed before 1pm. Free standard delivery on orders over ₦250,000." },
      { kind: "heading", text: "Other states" },
      { kind: "paragraph", text: "We use tracked courier services. You'll get a tracking number by SMS and email once your order ships." },
      { kind: "heading", text: "Processing" },
      { kind: "paragraph", text: "Paid orders are checked and packed within one working day. Bank transfer orders ship once the transfer is confirmed." },
    ],
    updatedAt: iso(20),
  },
  {
    slug: "returns",
    title: "Returns and exchanges",
    intro: "If your hair isn't right, tell us within seven days of delivery.",
    blocks: [
      { kind: "list", items: ["Hair must be unworn and unwashed, with the lace uncut and bands attached.", "Braiding hair packs must be unopened.", "Opened care products can't be returned for hygiene reasons.", "Custom-coloured or cut units are final sale."] },
      { kind: "heading", text: "How to start a return" },
      { kind: "paragraph", text: "Message us with your order number and photos. Once approved, drop the hair at our Lekki studio or send it by courier. Refunds go back to your original payment method within five working days of inspection." },
    ],
    updatedAt: iso(20),
  },
  {
    slug: "privacy",
    title: "Privacy policy",
    intro: "This policy explains what personal information we collect and how we use it, in line with the Nigeria Data Protection Act 2023.",
    blocks: [
      { kind: "heading", text: "What we collect" },
      { kind: "paragraph", text: "Your name, contact details and delivery address when you place an order, and basic analytics about how the site is used." },
      { kind: "heading", text: "How we use it" },
      { kind: "paragraph", text: "To deliver your order, provide support, and, if you opt in, send occasional updates. We never sell your information." },
      { kind: "heading", text: "Payments" },
      { kind: "paragraph", text: "Card payments are processed by our payment provider. We never see or store your full card details." },
      { kind: "heading", text: "Your rights" },
      { kind: "paragraph", text: "You can ask us for a copy of your data or ask us to delete it by emailing us." },
    ],
    updatedAt: iso(60),
  },
  {
    slug: "terms",
    title: "Terms of sale",
    intro: "These terms apply to every order placed on this site.",
    blocks: [
      { kind: "paragraph", text: "Prices are shown in Nigerian naira and include applicable taxes. The price charged is the one confirmed at checkout." },
      { kind: "paragraph", text: "An order is accepted once payment is confirmed, or, for pay on delivery, once we call to confirm." },
      { kind: "paragraph", text: "Colours may vary slightly between screens. Lengths are measured straight." },
      { kind: "paragraph", text: "Returns are covered by our returns policy." },
    ],
    updatedAt: iso(60),
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
    usageCount: 41,
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
    usageCount: 63,
    oncePerCustomer: false,
    status: "active",
  },
  {
    id: "disc_ship",
    code: "FREESHIPNG",
    title: "Free shipping, December",
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
  { id: "inq_1", name: "Ifeoma C.", email: "ifeoma@example.com", phone: "+234 801 000 0001", topic: "order", orderNumber: "IR-10412", message: "Hi, my rider hasn't called yet. Is the order still coming today?", status: "new", replies: [], createdAt: iso(0, 9) },
  { id: "inq_2", name: "Aisha Y.", email: "aisha@example.com", phone: null, topic: "product", orderNumber: null, message: "Does the 26 inch bone straight come in 250% density with a 5x5 closure instead of frontal?", status: "open", replies: [{ id: "rep_1", author: "Kemi (Support)", body: "Yes, we can make it on request. It takes 3 working days.", createdAt: iso(1, 12) }], createdAt: iso(1, 10) },
  { id: "inq_3", name: "Ruth A.", email: "ruth@example.com", phone: "+234 801 000 0003", topic: "wholesale", orderNumber: null, message: "I run a salon in Benin City and want to order 20 packs of braiding hair monthly. Do you have wholesale pricing?", status: "new", replies: [], createdAt: iso(2, 15) },
  { id: "inq_4", name: "Tolu F.", email: "tolu@example.com", phone: null, topic: "other", orderNumber: null, message: "Can I book an install at the Lekki studio for Saturday?", status: "closed", replies: [{ id: "rep_2", author: "Kemi (Support)", body: "Booked for 11am Saturday. See you then.", createdAt: iso(5, 11) }], createdAt: iso(5, 9) },
];

/* ------------------------------------------------------------- staff/roles */

export const seedRoles: Role[] = [
  { id: "role_owner", name: "Owner", description: "Full access, including staff and payment settings.", permissions: [
    "dashboard:read", "products:read", "products:write", "collections:write", "inventory:write", "media:write", "orders:read", "orders:write", "orders:refund", "content:write", "discounts:write", "reviews:moderate", "inquiries:respond", "settings:write", "staff:manage",
  ], system: true },
  { id: "role_manager", name: "Store manager", description: "Runs the catalog, content and orders. No staff or payment settings.", permissions: [
    "dashboard:read", "products:read", "products:write", "collections:write", "inventory:write", "media:write", "orders:read", "orders:write", "content:write", "discounts:write", "reviews:moderate", "inquiries:respond",
  ], system: false },
  { id: "role_fulfilment", name: "Fulfilment", description: "Packs and ships orders, updates stock.", permissions: ["dashboard:read", "products:read", "orders:read", "orders:write", "inventory:write", "inquiries:respond"], system: false },
];

export const seedStaff: Staff[] = [
  { id: "staff_owner", name: "Folake Adeyemi", email: "owner@irun.test", roleId: "role_owner", status: "active", lastActiveAt: iso(0, 8) },
  { id: "staff_manager", name: "Kemi Balogun", email: "manager@irun.test", roleId: "role_manager", status: "active", lastActiveAt: iso(0, 7) },
  { id: "staff_fulfil", name: "Sola Martins", email: "fulfilment@irun.test", roleId: "role_fulfilment", status: "active", lastActiveAt: iso(1, 16) },
];

/**
 * Mock-only sign-in passwords. The live backend must store salted hashes (argon2id) and
 * never return them. These exist so the permission-aware admin UI can be exercised locally.
 */
export const seedStaffPasswords: Record<string, string> = {
  "owner@irun.test": "demo-owner",
  "manager@irun.test": "demo-manager",
  "fulfilment@irun.test": "demo-fulfilment",
};

export const seedCustomer = {
  customer: { id: "cus_1", firstName: "Amaka", lastName: "Obi", email: "customer@irun.test", phone: "+234 802 000 0000", createdAt: iso(120) },
  password: "demo-customer",
};
