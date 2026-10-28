/**
 * In-memory database for mock mode. One instance per server process (kept on globalThis
 * so hot reloads and route handlers share it). Nothing here is persisted.
 */
import type {
  Collection,
  ContentPage,
  Customer,
  Discount,
  HomepageSection,
  Inquiry,
  Media,
  Navigation,
  Order,
  PaymentSettings,
  Product,
  ProductType,
  Review,
  Role,
  SavedAddress,
  ShippingSettings,
  Staff,
  StoreSettings,
} from "@/lib/types";
import {
  seedCollections,
  seedCustomer,
  seedCustomerAddresses,
  seedDiscounts,
  seedHomepage,
  seedInquiries,
  seedMedia,
  seedNavigation,
  seedPages,
  seedPayments,
  seedProducts,
  seedProductTypes,
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

export interface MockCustomerAccount {
  customer: Customer;
  /** Mock only. A real backend stores an argon2id hash. */
  password: string;
  addresses: SavedAddress[];
  wishlist: string[];
  marketingOptIn: boolean;
}

export interface MockDb {
  media: Media[];
  collections: Collection[];
  products: Product[];
  productTypes: ProductType[];
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
  accounts: MockCustomerAccount[];
  customerSessions: Map<string, string>;
  passwordResets: Map<string, { customerId: string; expiresAt: number }>;
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
    productTypes: clone(seedProductTypes),
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
    accounts: [{ customer: clone(seedCustomer.customer), password: seedCustomer.password, addresses: clone(seedCustomerAddresses), wishlist: [], marketingOptIn: false }],
    customerSessions: new Map(),
    passwordResets: new Map(),
    newsletter: new Set(),
    seq: 10400,
  };
  db.orders = buildSampleOrders(db.products);
  db.seq = 10400 + db.orders.length;
  return db;
}

const g = globalThis as unknown as { __qpMockDb?: MockDb };

export function getDb(): MockDb {
  if (!g.__qpMockDb) g.__qpMockDb = createDb();
  return g.__qpMockDb;
}

/** Test helper: start from fresh seed data. */
export function resetDb() {
  g.__qpMockDb = createDb();
  return g.__qpMockDb;
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
