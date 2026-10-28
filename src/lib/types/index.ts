/**
 * Shared domain types. These mirror the JSON shapes the Fastify backend returns
 * (see docs/API_CONTRACT.md). Keep this file free of runtime code so the backend
 * team can copy it verbatim into a shared package.
 *
 * Money is always an integer number of kobo (1 NGN = 100 kobo) to avoid float drift.
 * The backend is authoritative for every computed amount; the frontend only formats.
 */

export type ID = string;
export type ISODate = string;
/** Integer amount in kobo. */
export type Kobo = number;
export type CurrencyCode = "NGN";

/* ------------------------------------------------------------------ media */

export interface Media {
  id: ID;
  url: string;
  alt: string;
  width: number;
  height: number;
  mimeType: string;
  /** Optional low-quality placeholder (data URL) for blur-up. */
  blurDataUrl?: string;
  tags: string[];
  createdAt: ISODate;
  sizeBytes?: number;
}

/* ---------------------------------------------------------------- catalog */

export type PublishStatus = "draft" | "published" | "archived";

export interface Seo {
  title?: string;
  description?: string;
}

export interface Collection {
  id: ID;
  handle: string;
  title: string;
  /** Short line used on cards. */
  summary: string;
  description: string;
  image: Media | null;
  status: PublishStatus;
  /** Sort position, ascending. Controlled by the vendor in admin. */
  position: number;
  productCount: number;
  seo: Seo;
  updatedAt: ISODate;
}

export type Availability = "in_stock" | "low_stock" | "out_of_stock" | "preorder";

export interface ProductOption {
  /** e.g. "Length", "Density", "Lace", "Colour". */
  name: string;
  values: string[];
}

export interface VariantInventory {
  tracked: boolean;
  /** Units sellable now. Backend computes this (on hand minus reserved). */
  available: number;
  /** "deny" blocks overselling; "continue" allows preorders. */
  policy: "deny" | "continue";
  lowStockThreshold: number;
}

export interface Variant {
  id: ID;
  productId: ID;
  sku: string;
  title: string;
  /** Map of option name to selected value, e.g. { Length: '16"' }. */
  options: Record<string, string>;
  price: Kobo;
  compareAtPrice: Kobo | null;
  availability: Availability;
  inventory: VariantInventory;
  mediaId: ID | null;
  position: number;
}

export interface RatingSummary {
  average: number;
  count: number;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface Product {
  id: ID;
  handle: string;
  title: string;
  subtitle: string;
  description: string;
  status: PublishStatus;
  collectionIds: ID[];
  media: Media[];
  options: ProductOption[];
  variants: Variant[];
  priceRange: { min: Kobo; max: Kobo };
  compareAtPriceRange: { min: Kobo; max: Kobo } | null;
  availability: Availability;
  /** Industry details shown on the PDP: hair origin, texture, cap size, etc. */
  specs: ProductSpec[];
  careNotes: string[];
  tags: string[];
  rating: RatingSummary;
  featured: boolean;
  seo: Seo;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** Lighter shape for grids and search results. */
export interface ProductCard {
  id: ID;
  handle: string;
  title: string;
  subtitle: string;
  image: Media | null;
  hoverImage: Media | null;
  priceRange: { min: Kobo; max: Kobo };
  compareAtPriceRange: { min: Kobo; max: Kobo } | null;
  availability: Availability;
  rating: RatingSummary;
  /** Option values surfaced on the card, e.g. available lengths or colours. */
  swatches: { option: string; values: string[] } | null;
  badges: string[];
}

export type ProductSort = "featured" | "newest" | "price_asc" | "price_desc" | "rating";

export interface ProductQuery {
  collection?: string;
  q?: string;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
  /** Option filters, e.g. { Length: ['16"', '18"'] }. */
  options?: Record<string, string[]>;
  minPrice?: Kobo;
  maxPrice?: Kobo;
  inStock?: boolean;
}

export interface Facet {
  name: string;
  values: { value: string; count: number }[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ProductListing extends Paginated<ProductCard> {
  facets: Facet[];
  priceBounds: { min: Kobo; max: Kobo };
}

export interface CollectionWithProducts {
  collection: Collection;
  listing: ProductListing;
}

export interface ProductDetail {
  product: Product;
  collections: Pick<Collection, "id" | "handle" | "title">[];
  related: ProductCard[];
}

export interface SearchResult {
  query: string;
  products: ProductListing;
  collections: Pick<Collection, "id" | "handle" | "title" | "summary" | "image">[];
  suggestions: string[];
}

/* ---------------------------------------------------------------- reviews */

export type ReviewStatus = "pending" | "published" | "hidden";

export interface Review {
  id: ID;
  productId: ID;
  productTitle: string;
  author: string;
  location: string | null;
  rating: number;
  title: string;
  body: string;
  verifiedPurchase: boolean;
  status: ReviewStatus;
  reply: string | null;
  createdAt: ISODate;
}

export interface ReviewInput {
  author: string;
  email: string;
  location?: string;
  rating: number;
  title: string;
  body: string;
}

/* -------------------------------------------------------------------- cart */

export interface CartLine {
  id: ID;
  productId: ID;
  variantId: ID;
  handle: string;
  productTitle: string;
  variantTitle: string;
  image: Media | null;
  quantity: number;
  unitPrice: Kobo;
  compareAtPrice: Kobo | null;
  lineTotal: Kobo;
  /** Max quantity the backend will currently accept for this line. */
  maxQuantity: number;
  availability: Availability;
}

export interface CartDiscount {
  code: string;
  label: string;
  amount: Kobo;
}

export interface CartTotals {
  subtotal: Kobo;
  discountTotal: Kobo;
  /** null until an address and shipping method are known at checkout. */
  shippingTotal: Kobo | null;
  taxTotal: Kobo;
  total: Kobo;
}

export interface Cart {
  id: ID;
  currency: CurrencyCode;
  lines: CartLine[];
  itemCount: number;
  discounts: CartDiscount[];
  totals: CartTotals;
  /** Messages the backend wants the customer to see (price changed, stock reduced…). */
  notices: string[];
  updatedAt: ISODate;
}

export interface AddCartLineInput {
  variantId: ID;
  quantity: number;
}

/* ---------------------------------------------------------------- checkout */

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT - Abuja", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara",
] as const;
export type NigerianState = (typeof NIGERIAN_STATES)[number];

export interface Address {
  firstName: string;
  lastName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  landmark?: string;
  country: "NG";
}

export interface CheckoutContact {
  email: string;
  phone: string;
  marketingOptIn: boolean;
}

export interface ShippingRate {
  id: ID;
  label: string;
  description: string;
  amount: Kobo;
  etaDays: [number, number];
}

/** A shipping option as quoted for a specific cart, with the backend's totals if chosen. */
export interface ShippingQuote extends ShippingRate {
  totals: CartTotals & { shippingTotal: Kobo };
}

export type PaymentMethod = "paystack" | "flutterwave" | "bank_transfer" | "pay_on_delivery";

export interface ShippingRatesInput {
  cartId: ID;
  address: Pick<Address, "state" | "city">;
}

export interface CheckoutInput {
  cartId: ID;
  contact: CheckoutContact;
  shippingAddress: Address;
  shippingRateId: ID;
  paymentMethod: PaymentMethod;
  note?: string;
  /** Idempotency key so retries never create duplicate orders. */
  idempotencyKey: string;
}

export type PaymentStatus =
  | "pending"
  | "awaiting_transfer"
  | "authorized"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export interface BankTransferInstructions {
  bankName: string;
  accountName: string;
  accountNumber: string;
  reference: string;
  amount: Kobo;
  expiresAt: ISODate | null;
}

export interface PaymentSession {
  provider: PaymentMethod;
  status: PaymentStatus;
  reference: string;
  /** Hosted checkout URL (Paystack/Flutterwave). The frontend redirects to it. */
  redirectUrl: string | null;
  bankTransfer: BankTransferInstructions | null;
}

export interface CheckoutResult {
  order: OrderSummary;
  payment: PaymentSession;
}

/* ------------------------------------------------------------------ orders */

export type OrderStatus = "open" | "cancelled" | "completed";
export type FulfillmentStatus = "unfulfilled" | "processing" | "shipped" | "out_for_delivery" | "delivered" | "returned";

export interface OrderLine {
  id: ID;
  productId: ID;
  variantId: ID;
  title: string;
  variantTitle: string;
  sku: string;
  image: Media | null;
  quantity: number;
  unitPrice: Kobo;
  lineTotal: Kobo;
}

export interface OrderEvent {
  id: ID;
  type: "placed" | "payment" | "fulfillment" | "note" | "cancelled" | "refund";
  message: string;
  createdAt: ISODate;
  /** Internal events are only returned on admin endpoints. */
  internal?: boolean;
}

export interface OrderSummary {
  id: ID;
  number: string;
  /** Opaque token that lets a guest view their own order. */
  accessToken: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  paymentMethod: PaymentMethod;
  email: string;
  totals: Required<Omit<CartTotals, "shippingTotal">> & { shippingTotal: Kobo };
  itemCount: number;
  createdAt: ISODate;
}

export interface Order extends OrderSummary {
  lines: OrderLine[];
  contact: CheckoutContact;
  shippingAddress: Address;
  shippingRate: Pick<ShippingRate, "id" | "label" | "etaDays">;
  discounts: CartDiscount[];
  trackingNumber: string | null;
  carrier: string | null;
  note: string | null;
  timeline: OrderEvent[];
  bankTransfer: BankTransferInstructions | null;
}

export interface OrderTrackingInput {
  number: string;
  email: string;
}

/* --------------------------------------------------------------- customers */

export interface Customer {
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  createdAt: ISODate;
}

export interface CustomerSession {
  customer: Customer;
}

export interface Wishlist {
  productIds: ID[];
}

/* ------------------------------------------------------------------ content */

export interface NavItem {
  id: ID;
  label: string;
  href: string;
  children?: NavItem[];
}

export interface Navigation {
  main: NavItem[];
  footer: { id: ID; title: string; items: NavItem[] }[];
}

interface SectionBase {
  id: ID;
  enabled: boolean;
  position: number;
}

export interface HeroSection extends SectionBase {
  type: "hero";
  heading: string;
  body: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string } | null;
  image: Media | null;
  layerImage: Media | null;
  /** Facts shown under the hero, counted up on load. Use real numbers only. */
  stats: { value: number; suffix: string; label: string }[];
  /** Resolved by the backend: featured products shown as price tags on the hero art. */
  spotlight?: ProductCard[];
}

export interface MarqueeSection extends SectionBase {
  type: "marquee";
  items: string[];
}

export interface CtaBandSection extends SectionBase {
  type: "cta_band";
  heading: string;
  body: string;
  cta: { label: string; href: string };
  /** Opens WhatsApp with the store number instead of the link above. */
  whatsapp: boolean;
}

export interface CollectionsSection extends SectionBase {
  type: "collections";
  heading: string;
  body: string;
  /** Empty means "all published collections in admin order". */
  collectionIds: ID[];
}

export interface ProductRailSection extends SectionBase {
  type: "product_rail";
  heading: string;
  body: string;
  source: { kind: "featured" } | { kind: "collection"; collectionId: ID } | { kind: "newest" };
  limit: number;
  products?: ProductCard[];
}

export interface EditorialSection extends SectionBase {
  type: "editorial";
  heading: string;
  body: string;
  image: Media | null;
  cta: { label: string; href: string } | null;
  imageSide: "left" | "right";
}

export interface ShadeGuideSection extends SectionBase {
  type: "shade_guide";
  heading: string;
  body: string;
  shades: { code: string; name: string; hex: string }[];
}

export interface ReviewsSection extends SectionBase {
  type: "reviews";
  heading: string;
  reviews?: Review[];
}

export interface PromiseSection extends SectionBase {
  type: "promises";
  items: { title: string; body: string }[];
}

export type HomepageSection =
  | HeroSection
  | MarqueeSection
  | CtaBandSection
  | CollectionsSection
  | ProductRailSection
  | EditorialSection
  | ShadeGuideSection
  | ReviewsSection
  | PromiseSection;

export type HomepageSectionType = HomepageSection["type"];

export interface Homepage {
  sections: HomepageSection[];
  /** Collections resolved by the backend for the collections section. */
  collections: Collection[];
  updatedAt: ISODate;
}

export interface ContentPage {
  slug: string;
  title: string;
  intro: string;
  /** Simple structured body so the backend can store it as JSON. */
  blocks: ({ kind: "paragraph"; text: string } | { kind: "heading"; text: string } | { kind: "list"; items: string[] } | { kind: "qa"; question: string; answer: string })[];
  updatedAt: ISODate;
}

export interface Announcement {
  enabled: boolean;
  message: string;
  href: string | null;
}

/* ---------------------------------------------------------------- settings */

export interface BrandColors {
  /** Page background (default near-black). */
  background: string;
  /** Raised panels and cards. */
  panel: string;
  /** Primary actions, e.g. Add to bag (default pink). */
  primary: string;
  /** Highlights, prices on sale, ratings (default gold). */
  highlight: string;
  /** Soft tint used for secondary accents (default blush). */
  soft: string;
}

export interface StoreSettings {
  name: string;
  tagline: string;
  logo: Media | null;
  contactEmail: string;
  phone: string;
  whatsapp: string;
  address: string;
  currency: CurrencyCode;
  branding: {
    colors: BrandColors;
    /** Corner radius scale in px for interactive controls. */
    radius: number;
  };
  social: { instagram: string | null; tiktok: string | null; facebook: string | null };
  announcement: Announcement;
  freeShippingThreshold: Kobo | null;
}

export interface ShippingZone {
  id: ID;
  name: string;
  states: string[];
  rates: (ShippingRate & { freeOver: Kobo | null })[];
}

export interface ShippingSettings {
  zones: ShippingZone[];
  processingDays: [number, number];
}

export interface PaymentProviderSetting {
  enabled: boolean;
  mode: "test" | "live";
  /** Public key only. Secret keys are configured on the backend and never sent to the browser. */
  publicKey: string;
}

export interface PaymentSettings {
  paystack: PaymentProviderSetting;
  flutterwave: PaymentProviderSetting;
  bankTransfer: { enabled: boolean; bankName: string; accountName: string; accountNumber: string; instructions: string; holdHours: number };
  payOnDelivery: { enabled: boolean; states: string[]; maxOrderTotal: Kobo | null };
}

/** Public subset of payment settings the storefront needs to render choices. */
export interface PublicPaymentOptions {
  methods: { method: PaymentMethod; label: string; description: string }[];
}

/* ---------------------------------------------------------------- discounts */

export type DiscountKind = "percentage" | "fixed_amount" | "free_shipping";
export type DiscountStatus = "active" | "scheduled" | "expired" | "disabled";

export interface Discount {
  id: ID;
  code: string;
  title: string;
  kind: DiscountKind;
  /** Percentage (0–100) for percentage, kobo for fixed_amount, ignored for free_shipping. */
  value: number;
  minSubtotal: Kobo | null;
  appliesTo: { type: "all" } | { type: "collections"; ids: ID[] } | { type: "products"; ids: ID[] };
  startsAt: ISODate;
  endsAt: ISODate | null;
  usageLimit: number | null;
  usageCount: number;
  oncePerCustomer: boolean;
  status: DiscountStatus;
}

/* ---------------------------------------------------------------- inquiries */

export type InquiryStatus = "new" | "open" | "closed";

export interface Inquiry {
  id: ID;
  name: string;
  email: string;
  phone: string | null;
  topic: "order" | "product" | "wholesale" | "other";
  orderNumber: string | null;
  message: string;
  status: InquiryStatus;
  replies: { id: ID; author: string; body: string; createdAt: ISODate }[];
  createdAt: ISODate;
}

export interface InquiryInput {
  name: string;
  email: string;
  phone?: string;
  topic: Inquiry["topic"];
  orderNumber?: string;
  message: string;
}

/* -------------------------------------------------------------- admin/auth */

export const PERMISSIONS = [
  "dashboard:read",
  "products:read",
  "products:write",
  "collections:write",
  "inventory:write",
  "media:write",
  "orders:read",
  "orders:write",
  "orders:refund",
  "content:write",
  "discounts:write",
  "reviews:moderate",
  "inquiries:respond",
  "settings:write",
  "staff:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export interface Role {
  id: ID;
  name: string;
  description: string;
  permissions: Permission[];
  /** System roles (Owner) cannot be edited or deleted. */
  system: boolean;
}

export interface Staff {
  id: ID;
  name: string;
  email: string;
  roleId: ID;
  status: "active" | "invited" | "suspended";
  lastActiveAt: ISODate | null;
}

export interface AdminSession {
  staff: Staff;
  role: Role;
  permissions: Permission[];
  expiresAt: ISODate;
}

export interface AdminLoginInput {
  email: string;
  password: string;
}

/* ---------------------------------------------------------------- admin data */

export interface DashboardSummary {
  periodDays: number;
  revenue: Kobo;
  revenueChangePct: number | null;
  orders: number;
  averageOrderValue: Kobo;
  awaitingPayment: number;
  awaitingFulfillment: number;
  newInquiries: number;
  pendingReviews: number;
  revenueSeries: { date: string; amount: Kobo }[];
  lowStock: { variantId: ID; productId: ID; productTitle: string; variantTitle: string; sku: string; available: number }[];
  recentOrders: OrderSummary[];
  topProducts: { productId: ID; title: string; unitsSold: number; revenue: Kobo }[];
}

export interface InventoryRow {
  productId: ID;
  productTitle: string;
  variantId: ID;
  variantTitle: string;
  sku: string;
  available: number;
  tracked: boolean;
  policy: VariantInventory["policy"];
  lowStockThreshold: number;
  availability: Availability;
}

export interface InventoryAdjustment {
  variantId: ID;
  /** Positive to add stock, negative to remove. */
  delta: number;
  reason: "received" | "correction" | "damaged" | "returned";
  note?: string;
}

/**
 * Create/update payload. For variants that already exist (have an id), inventory.available
 * is ignored: stock changes go through POST /admin/inventory/adjustments so they're audited.
 */
export type ProductInput = Omit<Product, "id" | "priceRange" | "compareAtPriceRange" | "availability" | "rating" | "createdAt" | "updatedAt" | "variants" | "media"> & {
  mediaIds: ID[];
  variants: (Omit<Variant, "id" | "productId" | "availability" | "inventory"> & {
    id?: ID;
    inventory: Omit<VariantInventory, "available"> & { available: number };
  })[];
};

export type CollectionInput = Omit<Collection, "id" | "productCount" | "updatedAt" | "image"> & { imageId: ID | null };

export type DiscountInput = Omit<Discount, "id" | "usageCount" | "status"> & { status: "active" | "disabled" };

export interface AdminOrderQuery {
  q?: string;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  page?: number;
  pageSize?: number;
}

export interface AdminProductQuery {
  q?: string;
  status?: PublishStatus;
  collectionId?: ID;
  page?: number;
  pageSize?: number;
}

export interface FulfillmentUpdate {
  fulfillmentStatus: FulfillmentStatus;
  carrier?: string;
  trackingNumber?: string;
  notifyCustomer: boolean;
}

/* ----------------------------------------------------------------- errors */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}
