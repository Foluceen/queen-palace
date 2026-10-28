/**
 * In-memory database for mock mode. One instance per server process (kept on globalThis
 * so hot reloads and route handlers share it). Nothing here is persisted.
 */
import type {
  Collection,
  ContentPage,
  Discount,
  HomepageSection,
  Inquiry,
  Media,
  Navigation,
  Order,
  PaymentSettings,
  Product,
  Review,
  Role,
  ShippingSettings,
  Staff,
  StoreSettings,
} from "@/lib/types";
import {
  seedCollections,
  seedCustomer,
  seedDiscounts,
  seedHomepage,
  seedInquiries,
  seedMedia,
  seedNavigation,
  seedPages,
  seedPayments,
  seedProducts,
  seedReviews,
  seedRoles,
  seedSettings,
  seedShipping,
  seedStaff,
  seedStaffPasswords,
} from "./seed";
import { buildSampleOrders } from "./sample-orders";

export interface MockCart {
  id: string;
  lines: { id: string; variantId: string; quantity: number }[];
  codes: string[];
  notices: string[];
  updatedAt: string;
}

export interface MockDb {
  media: Media[];
  collections: Collection[];
  products: Product[];
  reviews: Review[];
  carts: Map<string, MockCart>;
  orders: Order[];
  idempotency: Map<string, string>;
  discounts: Discount[];
  inquiries: Inquiry[];
  settings: StoreSettings;
  shipping: ShippingSettings;
  payments: PaymentSettings;
  homepage: HomepageSection[];
  navigation: Navigation;
  pages: ContentPage[];
  staff: Staff[];
  roles: Role[];
  staffPasswords: Record<string, string>;
  adminSessions: Map<string, { staffId: string; expiresAt: number }>;
  customer: typeof seedCustomer;
  customerSessions: Set<string>;
  wishlist: string[];
  newsletter: Set<string>;
  seq: number;
}

function createDb(): MockDb {
  const clone = <T,>(v: T): T => structuredClone(v);
  const products = clone(seedProducts);
  const db: MockDb = {
    media: clone(seedMedia),
    collections: clone(seedCollections),
    products,
    reviews: clone(seedReviews),
    carts: new Map(),
    orders: [],
    idempotency: new Map(),
    discounts: clone(seedDiscounts),
    inquiries: clone(seedInquiries),
    settings: clone(seedSettings),
    shipping: clone(seedShipping),
    payments: clone(seedPayments),
    homepage: clone(seedHomepage),
    navigation: clone(seedNavigation),
    pages: clone(seedPages),
    staff: clone(seedStaff),
    roles: clone(seedRoles),
    staffPasswords: { ...seedStaffPasswords },
    adminSessions: new Map(),
    customer: clone(seedCustomer),
    customerSessions: new Set(),
    wishlist: [],
    newsletter: new Set(),
    seq: 10400,
  };
  db.orders = buildSampleOrders(db.products);
  db.seq = 10400 + db.orders.length;
  return db;
}

const g = globalThis as unknown as { __irunMockDb?: MockDb };

export function getDb(): MockDb {
  if (!g.__irunMockDb) g.__irunMockDb = createDb();
  return g.__irunMockDb;
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
