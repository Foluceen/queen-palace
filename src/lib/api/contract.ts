/**
 * The HTTP contract between this frontend and the Fastify backend.
 *
 * Every endpoint is declared once here: method, path and its request/response types.
 * The typed client (client.ts) and the mock backend (src/lib/mock/router.ts) are both
 * driven from this table, so they cannot drift apart. docs/API_CONTRACT.md is the
 * human-readable version.
 *
 * Conventions:
 * - Base URL already includes the version prefix, e.g. https://api.example.com/v1
 * - JSON bodies; money in integer kobo; dates ISO 8601 UTC.
 * - Errors: non-2xx with ApiErrorBody.
 * - Admin and customer endpoints authenticate with an httpOnly session cookie
 *   (credentials: "include"); the backend enforces permissions on every call.
 */
import type {
  AddCartLineInput,
  AdminLoginInput,
  AdminOrderQuery,
  AdminProductQuery,
  AdminSession,
  Cart,
  CheckoutInput,
  CheckoutResult,
  Collection,
  CollectionInput,
  CollectionWithProducts,
  ContentPage,
  ContentPage as ContentPageT,
  Customer,
  CustomerDetail,
  CustomerRegisterInput,
  CustomerSession,
  CustomerSummary,
  AnalyticsReport,
  AdminSearchResult,
  ProductType,
  ProductTypeInput,
  SavedAddress,
  DashboardSummary,
  Discount,
  DiscountInput,
  FulfillmentUpdate,
  Homepage,
  HomepageSection,
  Inquiry,
  InquiryInput,
  InquiryStatus,
  InventoryAdjustment,
  InventoryRow,
  Media,
  Navigation,
  Order,
  OrderSummary,
  OrderTrackingInput,
  Paginated,
  PaymentSettings,
  Product,
  ProductDetail,
  ProductInput,
  ProductListing,
  ProductQuery,
  PublicPaymentOptions,
  Review,
  ReviewInput,
  ReviewStatus,
  Role,
  SearchResult,
  ShippingQuote,
  ShippingRatesInput,
  ShippingSettings,
  Staff,
  StoreSettings,
  Variant,
  Wishlist,
} from "@/lib/types";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Type-level description of one endpoint. */
export interface Endpoint<Params = undefined, Query = undefined, Body = undefined, Response = unknown> {
  params: Params;
  query: Query;
  body: Body;
  response: Response;
}

type Id = { id: string };
type Ok = { ok: true };
type Upload = { fileName: string; mimeType: string; sizeBytes: number; width: number; height: number; alt: string; tags: string[]; dataUrl: string };

export interface Contract {
  /* --------------------------------------------------------- storefront */
  getStoreSettings: Endpoint<undefined, undefined, undefined, StoreSettings>;
  getNavigation: Endpoint<undefined, undefined, undefined, Navigation>;
  getHomepage: Endpoint<undefined, undefined, undefined, Homepage>;
  getContentPage: Endpoint<{ slug: string }, undefined, undefined, ContentPage>;
  getPaymentOptions: Endpoint<undefined, undefined, undefined, PublicPaymentOptions>;
  listCollections: Endpoint<undefined, undefined, undefined, Collection[]>;
  getCollection: Endpoint<{ handle: string }, Omit<ProductQuery, "collection" | "options"> & { options?: string }, undefined, CollectionWithProducts>;
  listProducts: Endpoint<undefined, Omit<ProductQuery, "options"> & { options?: string; /** Comma-separated product ids (wishlist). */ ids?: string }, undefined, ProductListing>;
  getProduct: Endpoint<{ handle: string }, undefined, undefined, ProductDetail>;
  listProductReviews: Endpoint<{ productId: string }, { page?: number }, undefined, Paginated<Review>>;
  createProductReview: Endpoint<{ productId: string }, undefined, ReviewInput, { status: "pending" }>;
  search: Endpoint<undefined, { q: string; page?: number }, undefined, SearchResult>;

  /* ----------------------------------------------------------------- cart */
  createCart: Endpoint<undefined, undefined, { lines?: AddCartLineInput[] }, Cart>;
  getCart: Endpoint<{ cartId: string }, undefined, undefined, Cart>;
  addCartLines: Endpoint<{ cartId: string }, undefined, { lines: AddCartLineInput[] }, Cart>;
  updateCartLine: Endpoint<{ cartId: string; lineId: string }, undefined, { quantity: number }, Cart>;
  removeCartLine: Endpoint<{ cartId: string; lineId: string }, undefined, undefined, Cart>;
  applyDiscount: Endpoint<{ cartId: string }, undefined, { code: string }, Cart>;
  removeDiscount: Endpoint<{ cartId: string; code: string }, undefined, undefined, Cart>;

  /* ------------------------------------------------------------- checkout */
  getShippingRates: Endpoint<undefined, undefined, ShippingRatesInput, ShippingQuote[]>;
  placeOrder: Endpoint<undefined, undefined, CheckoutInput, CheckoutResult>;
  getOrder: Endpoint<{ number: string }, { token: string }, undefined, Order>;
  trackOrder: Endpoint<undefined, undefined, OrderTrackingInput, Order>;
  /** Re-queries the payment provider; returns the authoritative status. */
  verifyPayment: Endpoint<{ number: string }, undefined, { token: string; reference?: string }, Order>;

  /* --------------------------------------------------------- engagement */
  createInquiry: Endpoint<undefined, undefined, InquiryInput, { id: string; status: "new" }>;
  subscribeNewsletter: Endpoint<undefined, undefined, { email: string }, Ok>;

  /* ------------------------------------------------------------ customer */
  customerLogin: Endpoint<undefined, undefined, { email: string; password: string }, CustomerSession>;
  customerLogout: Endpoint<undefined, undefined, undefined, Ok>;
  getCustomer: Endpoint<undefined, undefined, undefined, CustomerSession>;
  listCustomerOrders: Endpoint<undefined, undefined, undefined, OrderSummary[]>;
  getWishlist: Endpoint<undefined, undefined, undefined, Wishlist>;
  replaceWishlist: Endpoint<undefined, undefined, Wishlist, Wishlist>;
  getCustomerAccount: Endpoint<undefined, undefined, undefined, Customer>;
  customerRegister: Endpoint<undefined, undefined, CustomerRegisterInput, CustomerSession>;
  /** Always returns ok (never reveals whether an email has an account). */
  customerRequestPasswordReset: Endpoint<undefined, undefined, { email: string }, Ok>;
  customerResetPassword: Endpoint<undefined, undefined, { token: string; password: string }, Ok>;
  listAddresses: Endpoint<undefined, undefined, undefined, SavedAddress[]>;
  saveAddress: Endpoint<undefined, undefined, Omit<SavedAddress, "id"> & { id?: string }, SavedAddress[]>;
  deleteAddress: Endpoint<Id, undefined, undefined, SavedAddress[]>;

  /* ---------------------------------------------------------- admin auth */
  adminLogin: Endpoint<undefined, undefined, AdminLoginInput, AdminSession>;
  adminLogout: Endpoint<undefined, undefined, undefined, Ok>;
  adminSession: Endpoint<undefined, undefined, undefined, AdminSession>;

  /* ---------------------------------------------------------- admin data */
  adminDashboard: Endpoint<undefined, { days?: number }, undefined, DashboardSummary>;

  adminListProducts: Endpoint<undefined, AdminProductQuery, undefined, Paginated<Product>>;
  adminGetProduct: Endpoint<Id, undefined, undefined, Product>;
  adminCreateProduct: Endpoint<undefined, undefined, ProductInput, Product>;
  adminUpdateProduct: Endpoint<Id, undefined, ProductInput, Product>;
  adminDeleteProduct: Endpoint<Id, undefined, undefined, Ok>;
  /** Creates a draft copy with "(copy)" in the name, a unique URL and SKUs, and zero stock. */
  adminDuplicateProduct: Endpoint<Id, undefined, undefined, Product>;
  adminListProductTypes: Endpoint<undefined, undefined, undefined, ProductType[]>;
  adminSaveProductType: Endpoint<undefined, undefined, ProductTypeInput, ProductType>;
  adminDeleteProductType: Endpoint<Id, undefined, undefined, Ok>;
  adminUpdateVariant: Endpoint<{ productId: string; variantId: string }, undefined, Partial<Pick<Variant, "price" | "compareAtPrice" | "sku">>, Variant>;

  adminListInventory: Endpoint<undefined, { q?: string; lowOnly?: boolean }, undefined, InventoryRow[]>;
  adminAdjustInventory: Endpoint<undefined, undefined, InventoryAdjustment, InventoryRow>;

  adminListCollections: Endpoint<undefined, undefined, undefined, Collection[]>;
  adminCreateCollection: Endpoint<undefined, undefined, CollectionInput, Collection>;
  adminUpdateCollection: Endpoint<Id, undefined, Partial<CollectionInput>, Collection>;
  /** Products are never deleted with a collection. Products left in no collection are listed. */
  adminDeleteCollection: Endpoint<Id, undefined, undefined, { ok: true; unassignedProductIds: string[] }>;
  adminReorderCollections: Endpoint<undefined, undefined, { ids: string[] }, Collection[]>;

  adminListMedia: Endpoint<undefined, { q?: string }, undefined, Media[]>;
  /**
   * Live backends should prefer a signed direct upload (POST /admin/media/uploads → PUT to storage → POST /admin/media);
   * this single-request form is what the mock implements and is acceptable for small images.
   */
  adminUploadMedia: Endpoint<undefined, undefined, Upload, Media>;
  adminUpdateMedia: Endpoint<Id, undefined, Pick<Media, "alt" | "tags">, Media>;
  adminDeleteMedia: Endpoint<Id, undefined, undefined, Ok>;

  adminListOrders: Endpoint<undefined, AdminOrderQuery, undefined, Paginated<OrderSummary>>;
  adminGetOrder: Endpoint<Id, undefined, undefined, Order>;
  adminUpdateFulfillment: Endpoint<Id, undefined, FulfillmentUpdate, Order>;
  adminMarkTransferReceived: Endpoint<Id, undefined, { reference: string; note?: string }, Order>;
  adminCancelOrder: Endpoint<Id, undefined, { reason: string; restock: boolean }, Order>;
  adminRefundOrder: Endpoint<Id, undefined, { amount: number; reason: string }, Order>;
  adminAddOrderNote: Endpoint<Id, undefined, { message: string }, Order>;

  adminGetHomepage: Endpoint<undefined, undefined, undefined, Homepage>;
  adminUpdateHomepage: Endpoint<undefined, undefined, { sections: HomepageSection[] }, Homepage>;
  adminGetNavigation: Endpoint<undefined, undefined, undefined, Navigation>;
  adminUpdateNavigation: Endpoint<undefined, undefined, Navigation, Navigation>;
  adminListPages: Endpoint<undefined, undefined, undefined, ContentPageT[]>;
  adminSavePage: Endpoint<{ slug: string }, undefined, Omit<ContentPageT, "slug" | "updatedAt">, ContentPageT>;
  adminListCustomers: Endpoint<undefined, { q?: string; page?: number; pageSize?: number }, undefined, Paginated<CustomerSummary>>;
  adminGetCustomer: Endpoint<Id, undefined, undefined, CustomerDetail>;
  adminAnalytics: Endpoint<undefined, { days?: number }, undefined, AnalyticsReport>;
  adminSearch: Endpoint<undefined, { q: string }, undefined, AdminSearchResult>;

  adminListDiscounts: Endpoint<undefined, undefined, undefined, Discount[]>;
  adminCreateDiscount: Endpoint<undefined, undefined, DiscountInput, Discount>;
  adminUpdateDiscount: Endpoint<Id, undefined, DiscountInput, Discount>;
  adminDeleteDiscount: Endpoint<Id, undefined, undefined, Ok>;

  adminListReviews: Endpoint<undefined, { status?: ReviewStatus }, undefined, Review[]>;
  adminModerateReview: Endpoint<Id, undefined, { status: ReviewStatus; reply?: string | null }, Review>;
  adminListInquiries: Endpoint<undefined, { status?: InquiryStatus }, undefined, Inquiry[]>;
  adminUpdateInquiry: Endpoint<Id, undefined, { status?: InquiryStatus; reply?: string }, Inquiry>;

  adminGetShippingSettings: Endpoint<undefined, undefined, undefined, ShippingSettings>;
  adminUpdateShippingSettings: Endpoint<undefined, undefined, ShippingSettings, ShippingSettings>;
  adminGetPaymentSettings: Endpoint<undefined, undefined, undefined, PaymentSettings>;
  adminUpdatePaymentSettings: Endpoint<undefined, undefined, PaymentSettings, PaymentSettings>;
  adminGetStoreSettings: Endpoint<undefined, undefined, undefined, StoreSettings>;
  adminUpdateStoreSettings: Endpoint<undefined, undefined, Omit<StoreSettings, "logo" | "logoDark"> & { logoId: string | null; logoDarkId: string | null }, StoreSettings>;

  adminListStaff: Endpoint<undefined, undefined, undefined, Staff[]>;
  adminInviteStaff: Endpoint<undefined, undefined, { name: string; email: string; roleId: string }, Staff>;
  adminUpdateStaff: Endpoint<Id, undefined, Partial<Pick<Staff, "roleId" | "status" | "name">>, Staff>;
  adminRemoveStaff: Endpoint<Id, undefined, undefined, Ok>;
  adminListRoles: Endpoint<undefined, undefined, undefined, Role[]>;
  adminSaveRole: Endpoint<undefined, undefined, Omit<Role, "id" | "system"> & { id?: string }, Role>;
  adminDeleteRole: Endpoint<Id, undefined, undefined, Ok>;
}

export type EndpointName = keyof Contract;

export const routes: { [K in EndpointName]: { method: HttpMethod; path: string; auth?: "customer" | "admin" } } = {
  getStoreSettings: { method: "GET", path: "/store/settings" },
  getNavigation: { method: "GET", path: "/store/navigation" },
  getHomepage: { method: "GET", path: "/store/homepage" },
  getContentPage: { method: "GET", path: "/store/pages/:slug" },
  getPaymentOptions: { method: "GET", path: "/store/payment-options" },
  listCollections: { method: "GET", path: "/collections" },
  getCollection: { method: "GET", path: "/collections/:handle" },
  listProducts: { method: "GET", path: "/products" },
  getProduct: { method: "GET", path: "/products/:handle" },
  listProductReviews: { method: "GET", path: "/products/:productId/reviews" },
  createProductReview: { method: "POST", path: "/products/:productId/reviews" },
  search: { method: "GET", path: "/search" },

  createCart: { method: "POST", path: "/carts" },
  getCart: { method: "GET", path: "/carts/:cartId" },
  addCartLines: { method: "POST", path: "/carts/:cartId/lines" },
  updateCartLine: { method: "PATCH", path: "/carts/:cartId/lines/:lineId" },
  removeCartLine: { method: "DELETE", path: "/carts/:cartId/lines/:lineId" },
  applyDiscount: { method: "POST", path: "/carts/:cartId/discounts" },
  removeDiscount: { method: "DELETE", path: "/carts/:cartId/discounts/:code" },

  getShippingRates: { method: "POST", path: "/checkout/shipping-rates" },
  placeOrder: { method: "POST", path: "/checkout" },
  getOrder: { method: "GET", path: "/orders/:number" },
  trackOrder: { method: "POST", path: "/orders/track" },
  verifyPayment: { method: "POST", path: "/orders/:number/verify-payment" },

  createInquiry: { method: "POST", path: "/inquiries" },
  subscribeNewsletter: { method: "POST", path: "/newsletter" },

  customerLogin: { method: "POST", path: "/customers/auth/login" },
  customerLogout: { method: "POST", path: "/customers/auth/logout", auth: "customer" },
  getCustomer: { method: "GET", path: "/customers/me/session", auth: "customer" },
  getCustomerAccount: { method: "GET", path: "/customers/me", auth: "customer" },
  listCustomerOrders: { method: "GET", path: "/customers/me/orders", auth: "customer" },
  getWishlist: { method: "GET", path: "/customers/me/wishlist", auth: "customer" },
  customerRegister: { method: "POST", path: "/customers/auth/register" },
  customerRequestPasswordReset: { method: "POST", path: "/customers/auth/password-reset" },
  customerResetPassword: { method: "POST", path: "/customers/auth/password-reset/confirm" },
  listAddresses: { method: "GET", path: "/customers/me/addresses", auth: "customer" },
  saveAddress: { method: "PUT", path: "/customers/me/addresses", auth: "customer" },
  deleteAddress: { method: "DELETE", path: "/customers/me/addresses/:id", auth: "customer" },
  replaceWishlist: { method: "PUT", path: "/customers/me/wishlist", auth: "customer" },

  adminLogin: { method: "POST", path: "/admin/auth/login" },
  adminLogout: { method: "POST", path: "/admin/auth/logout", auth: "admin" },
  adminSession: { method: "GET", path: "/admin/auth/session", auth: "admin" },
  adminDashboard: { method: "GET", path: "/admin/dashboard", auth: "admin" },

  adminListProducts: { method: "GET", path: "/admin/products", auth: "admin" },
  adminGetProduct: { method: "GET", path: "/admin/products/:id", auth: "admin" },
  adminCreateProduct: { method: "POST", path: "/admin/products", auth: "admin" },
  adminUpdateProduct: { method: "PUT", path: "/admin/products/:id", auth: "admin" },
  adminDeleteProduct: { method: "DELETE", path: "/admin/products/:id", auth: "admin" },
  adminDuplicateProduct: { method: "POST", path: "/admin/products/:id/duplicate", auth: "admin" },
  adminListProductTypes: { method: "GET", path: "/admin/product-types", auth: "admin" },
  adminSaveProductType: { method: "PUT", path: "/admin/product-types", auth: "admin" },
  adminDeleteProductType: { method: "DELETE", path: "/admin/product-types/:id", auth: "admin" },
  adminUpdateVariant: { method: "PATCH", path: "/admin/products/:productId/variants/:variantId", auth: "admin" },

  adminListInventory: { method: "GET", path: "/admin/inventory", auth: "admin" },
  adminAdjustInventory: { method: "POST", path: "/admin/inventory/adjustments", auth: "admin" },

  adminListCollections: { method: "GET", path: "/admin/collections", auth: "admin" },
  adminCreateCollection: { method: "POST", path: "/admin/collections", auth: "admin" },
  adminUpdateCollection: { method: "PATCH", path: "/admin/collections/:id", auth: "admin" },
  adminDeleteCollection: { method: "DELETE", path: "/admin/collections/:id", auth: "admin" },
  adminReorderCollections: { method: "PUT", path: "/admin/collections/order", auth: "admin" },

  adminListMedia: { method: "GET", path: "/admin/media", auth: "admin" },
  adminUploadMedia: { method: "POST", path: "/admin/media", auth: "admin" },
  adminUpdateMedia: { method: "PATCH", path: "/admin/media/:id", auth: "admin" },
  adminDeleteMedia: { method: "DELETE", path: "/admin/media/:id", auth: "admin" },

  adminListOrders: { method: "GET", path: "/admin/orders", auth: "admin" },
  adminGetOrder: { method: "GET", path: "/admin/orders/:id", auth: "admin" },
  adminUpdateFulfillment: { method: "POST", path: "/admin/orders/:id/fulfillment", auth: "admin" },
  adminMarkTransferReceived: { method: "POST", path: "/admin/orders/:id/transfer-received", auth: "admin" },
  adminCancelOrder: { method: "POST", path: "/admin/orders/:id/cancel", auth: "admin" },
  adminRefundOrder: { method: "POST", path: "/admin/orders/:id/refunds", auth: "admin" },
  adminAddOrderNote: { method: "POST", path: "/admin/orders/:id/notes", auth: "admin" },

  adminGetHomepage: { method: "GET", path: "/admin/content/homepage", auth: "admin" },
  adminUpdateHomepage: { method: "PUT", path: "/admin/content/homepage", auth: "admin" },
  adminGetNavigation: { method: "GET", path: "/admin/content/navigation", auth: "admin" },
  adminUpdateNavigation: { method: "PUT", path: "/admin/content/navigation", auth: "admin" },
  adminListPages: { method: "GET", path: "/admin/pages", auth: "admin" },
  adminSavePage: { method: "PUT", path: "/admin/pages/:slug", auth: "admin" },
  adminListCustomers: { method: "GET", path: "/admin/customers", auth: "admin" },
  adminGetCustomer: { method: "GET", path: "/admin/customers/:id", auth: "admin" },
  adminAnalytics: { method: "GET", path: "/admin/analytics", auth: "admin" },
  adminSearch: { method: "GET", path: "/admin/search", auth: "admin" },

  adminListDiscounts: { method: "GET", path: "/admin/discounts", auth: "admin" },
  adminCreateDiscount: { method: "POST", path: "/admin/discounts", auth: "admin" },
  adminUpdateDiscount: { method: "PUT", path: "/admin/discounts/:id", auth: "admin" },
  adminDeleteDiscount: { method: "DELETE", path: "/admin/discounts/:id", auth: "admin" },

  adminListReviews: { method: "GET", path: "/admin/reviews", auth: "admin" },
  adminModerateReview: { method: "PATCH", path: "/admin/reviews/:id", auth: "admin" },
  adminListInquiries: { method: "GET", path: "/admin/inquiries", auth: "admin" },
  adminUpdateInquiry: { method: "PATCH", path: "/admin/inquiries/:id", auth: "admin" },

  adminGetShippingSettings: { method: "GET", path: "/admin/settings/shipping", auth: "admin" },
  adminUpdateShippingSettings: { method: "PUT", path: "/admin/settings/shipping", auth: "admin" },
  adminGetPaymentSettings: { method: "GET", path: "/admin/settings/payments", auth: "admin" },
  adminUpdatePaymentSettings: { method: "PUT", path: "/admin/settings/payments", auth: "admin" },
  adminGetStoreSettings: { method: "GET", path: "/admin/settings/store", auth: "admin" },
  adminUpdateStoreSettings: { method: "PUT", path: "/admin/settings/store", auth: "admin" },

  adminListStaff: { method: "GET", path: "/admin/staff", auth: "admin" },
  adminInviteStaff: { method: "POST", path: "/admin/staff", auth: "admin" },
  adminUpdateStaff: { method: "PATCH", path: "/admin/staff/:id", auth: "admin" },
  adminRemoveStaff: { method: "DELETE", path: "/admin/staff/:id", auth: "admin" },
  adminListRoles: { method: "GET", path: "/admin/roles", auth: "admin" },
  adminSaveRole: { method: "PUT", path: "/admin/roles", auth: "admin" },
  adminDeleteRole: { method: "DELETE", path: "/admin/roles/:id", auth: "admin" },
};

/** Builds the argument object for an endpoint, omitting parts that are undefined. */
export type RequestOf<K extends EndpointName> = (Contract[K]["params"] extends undefined ? { params?: undefined } : { params: Contract[K]["params"] }) &
  (Contract[K]["query"] extends undefined ? { query?: undefined } : { query?: Contract[K]["query"] }) &
  (Contract[K]["body"] extends undefined ? { body?: undefined } : { body: Contract[K]["body"] });

export type ResponseOf<K extends EndpointName> = Contract[K]["response"];

/** Encodes option filters for query strings: Length:16",18"|Lace:HD → see decodeOptions. */
export function encodeOptions(options: Record<string, string[]> | undefined): string | undefined {
  if (!options) return undefined;
  const parts = Object.entries(options)
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => `${k}:${v.join(",")}`);
  return parts.length ? parts.join("|") : undefined;
}

export function decodeOptions(raw: string | undefined | null): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!raw) return out;
  for (const part of raw.split("|")) {
    const idx = part.indexOf(":");
    if (idx <= 0) continue;
    const key = part.slice(0, idx);
    const values = part.slice(idx + 1).split(",").filter(Boolean);
    if (values.length) out[key] = values;
  }
  return out;
}
