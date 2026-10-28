# API contract

Generated from `src/lib/api/contract.ts`, which is the source of truth. The typed client and the mock backend are both driven by it.

## Conventions

- Base URL includes the version, e.g. `https://api.example.com/v1`. Set `API_BASE_URL` (server) and `NEXT_PUBLIC_API_BASE_URL` (browser).
- JSON in and out. Money is **integer kobo** (`16500000` = ₦165,000). Dates are ISO 8601 UTC.
- Errors: non-2xx with `{ "error": { "code": string, "message": string, "fields"?: Record<string,string> } }`. `message` is shown to customers and staff, so write it in plain language. `fields` maps form field names to messages (use dotted paths like `variants.0.price`).
- Auth: `customer` and `admin` endpoints use an **httpOnly, Secure, SameSite=Lax session cookie**. The browser sends `credentials: "include"`, so CORS must allow the storefront origin with credentials.
- **The backend is authoritative** for prices, discounts, stock, shipping fees, totals and payment status. Every admin endpoint must check the permission listed in `docs/BACKEND_INTEGRATION.md`; the UI hides controls but is not a security boundary.
- Query strings: option filters are encoded as `options=Length:16",18"|Colour:1B`.
- Types referenced below live in `src/lib/types/index.ts`.

## Storefront

| Name | Method and path | Auth | Path params | Query | Body | Response |
|---|---|---|---|---|---|---|
| getStoreSettings | `GET /store/settings` | public |  |  |  | `StoreSettings` |
| getNavigation | `GET /store/navigation` | public |  |  |  | `Navigation` |
| getHomepage | `GET /store/homepage` | public |  |  |  | `Homepage` |
| getContentPage | `GET /store/pages/:slug` | public | `{ slug: string }` |  |  | `ContentPage` |
| getPaymentOptions | `GET /store/payment-options` | public |  |  |  | `PublicPaymentOptions` |
| listCollections | `GET /collections` | public |  |  |  | `Collection[]` |
| getCollection | `GET /collections/:handle` | public | `{ handle: string }` | `Omit<ProductQuery, "collection" \| "options"> & { options?: string }` |  | `CollectionWithProducts` |
| listProducts | `GET /products` | public |  | `Omit<ProductQuery, "options"> & { options?: string; /** Comma-separated product ids (wishlist). */ ids?: string }` |  | `ProductListing` |
| getProduct | `GET /products/:handle` | public | `{ handle: string }` |  |  | `ProductDetail` |
| listProductReviews | `GET /products/:productId/reviews` | public | `{ productId: string }` | `{ page?: number }` |  | `Paginated<Review>` |
| createProductReview | `POST /products/:productId/reviews` | public | `{ productId: string }` |  | `ReviewInput` | `{ status: "pending" }` |
| search | `GET /search` | public |  | `{ q: string; page?: number }` |  | `SearchResult` |

## Cart

| Name | Method and path | Auth | Path params | Query | Body | Response |
|---|---|---|---|---|---|---|
| createCart | `POST /carts` | public |  |  | `{ lines?: AddCartLineInput[] }` | `Cart` |
| getCart | `GET /carts/:cartId` | public | `{ cartId: string }` |  |  | `Cart` |
| addCartLines | `POST /carts/:cartId/lines` | public | `{ cartId: string }` |  | `{ lines: AddCartLineInput[] }` | `Cart` |
| updateCartLine | `PATCH /carts/:cartId/lines/:lineId` | public | `{ cartId: string; lineId: string }` |  | `{ quantity: number }` | `Cart` |
| removeCartLine | `DELETE /carts/:cartId/lines/:lineId` | public | `{ cartId: string; lineId: string }` |  |  | `Cart` |
| applyDiscount | `POST /carts/:cartId/discounts` | public | `{ cartId: string }` |  | `{ code: string }` | `Cart` |
| removeDiscount | `DELETE /carts/:cartId/discounts/:code` | public | `{ cartId: string; code: string }` |  |  | `Cart` |

## Checkout and orders

| Name | Method and path | Auth | Path params | Query | Body | Response |
|---|---|---|---|---|---|---|
| getShippingRates | `POST /checkout/shipping-rates` | public |  |  | `ShippingRatesInput` | `ShippingQuote[]` |
| placeOrder | `POST /checkout` | public |  |  | `CheckoutInput` | `CheckoutResult` |
| getOrder | `GET /orders/:number` | public | `{ number: string }` | `{ token: string }` |  | `Order` |
| trackOrder | `POST /orders/track` | public |  |  | `OrderTrackingInput` | `Order` |
| verifyPayment | `POST /orders/:number/verify-payment` | public | `{ number: string }` |  | `{ token: string; reference?: string }` | `Order` |

## Engagement

| Name | Method and path | Auth | Path params | Query | Body | Response |
|---|---|---|---|---|---|---|
| createInquiry | `POST /inquiries` | public |  |  | `InquiryInput` | `{ id: string; status: "new" }` |
| subscribeNewsletter | `POST /newsletter` | public |  |  | `{ email: string }` | `Ok` |

## Customer account

| Name | Method and path | Auth | Path params | Query | Body | Response |
|---|---|---|---|---|---|---|
| customerLogin | `POST /customers/auth/login` | public |  |  | `{ email: string; password: string }` | `CustomerSession` |
| customerLogout | `POST /customers/auth/logout` | customer |  |  |  | `Ok` |
| getCustomer | `GET /customers/me/session` | customer |  |  |  | `CustomerSession` |
| getCustomerAccount | `GET /customers/me` | customer |  |  |  | `Customer` |
| listCustomerOrders | `GET /customers/me/orders` | customer |  |  |  | `OrderSummary[]` |
| getWishlist | `GET /customers/me/wishlist` | customer |  |  |  | `Wishlist` |
| replaceWishlist | `PUT /customers/me/wishlist` | customer |  |  | `Wishlist` | `Wishlist` |

## Admin

| Name | Method and path | Auth | Path params | Query | Body | Response |
|---|---|---|---|---|---|---|
| adminLogin | `POST /admin/auth/login` | public |  |  | `AdminLoginInput` | `AdminSession` |
| adminLogout | `POST /admin/auth/logout` | admin |  |  |  | `Ok` |
| adminSession | `GET /admin/auth/session` | admin |  |  |  | `AdminSession` |
| adminDashboard | `GET /admin/dashboard` | admin |  | `{ days?: number }` |  | `DashboardSummary` |
| adminListProducts | `GET /admin/products` | admin |  | `AdminProductQuery` |  | `Paginated<Product>` |
| adminGetProduct | `GET /admin/products/:id` | admin | `Id` |  |  | `Product` |
| adminCreateProduct | `POST /admin/products` | admin |  |  | `ProductInput` | `Product` |
| adminUpdateProduct | `PUT /admin/products/:id` | admin | `Id` |  | `ProductInput` | `Product` |
| adminDeleteProduct | `DELETE /admin/products/:id` | admin | `Id` |  |  | `Ok` |
| adminUpdateVariant | `PATCH /admin/products/:productId/variants/:variantId` | admin | `{ productId: string; variantId: string }` |  | `Partial<Pick<Variant, "price" \| "compareAtPrice" \| "sku">>` | `Variant` |
| adminListInventory | `GET /admin/inventory` | admin |  | `{ q?: string; lowOnly?: boolean }` |  | `InventoryRow[]` |
| adminAdjustInventory | `POST /admin/inventory/adjustments` | admin |  |  | `InventoryAdjustment` | `InventoryRow` |
| adminListCollections | `GET /admin/collections` | admin |  |  |  | `Collection[]` |
| adminCreateCollection | `POST /admin/collections` | admin |  |  | `CollectionInput` | `Collection` |
| adminUpdateCollection | `PATCH /admin/collections/:id` | admin | `Id` |  | `Partial<CollectionInput>` | `Collection` |
| adminDeleteCollection | `DELETE /admin/collections/:id` | admin | `Id` |  |  | `Ok` |
| adminReorderCollections | `PUT /admin/collections/order` | admin |  |  | `{ ids: string[] }` | `Collection[]` |
| adminListMedia | `GET /admin/media` | admin |  | `{ q?: string }` |  | `Media[]` |
| adminUploadMedia | `POST /admin/media` | admin |  |  | `Upload` | `Media` |
| adminUpdateMedia | `PATCH /admin/media/:id` | admin | `Id` |  | `Pick<Media, "alt" \| "tags">` | `Media` |
| adminDeleteMedia | `DELETE /admin/media/:id` | admin | `Id` |  |  | `Ok` |
| adminListOrders | `GET /admin/orders` | admin |  | `AdminOrderQuery` |  | `Paginated<OrderSummary>` |
| adminGetOrder | `GET /admin/orders/:id` | admin | `Id` |  |  | `Order` |
| adminUpdateFulfillment | `POST /admin/orders/:id/fulfillment` | admin | `Id` |  | `FulfillmentUpdate` | `Order` |
| adminMarkTransferReceived | `POST /admin/orders/:id/transfer-received` | admin | `Id` |  | `{ reference: string; note?: string }` | `Order` |
| adminCancelOrder | `POST /admin/orders/:id/cancel` | admin | `Id` |  | `{ reason: string; restock: boolean }` | `Order` |
| adminRefundOrder | `POST /admin/orders/:id/refunds` | admin | `Id` |  | `{ amount: number; reason: string }` | `Order` |
| adminAddOrderNote | `POST /admin/orders/:id/notes` | admin | `Id` |  | `{ message: string }` | `Order` |
| adminGetHomepage | `GET /admin/content/homepage` | admin |  |  |  | `Homepage` |
| adminUpdateHomepage | `PUT /admin/content/homepage` | admin |  |  | `{ sections: HomepageSection[] }` | `Homepage` |
| adminUpdateNavigation | `PUT /admin/content/navigation` | admin |  |  | `Navigation` | `Navigation` |
| adminListDiscounts | `GET /admin/discounts` | admin |  |  |  | `Discount[]` |
| adminCreateDiscount | `POST /admin/discounts` | admin |  |  | `DiscountInput` | `Discount` |
| adminUpdateDiscount | `PUT /admin/discounts/:id` | admin | `Id` |  | `DiscountInput` | `Discount` |
| adminDeleteDiscount | `DELETE /admin/discounts/:id` | admin | `Id` |  |  | `Ok` |
| adminListReviews | `GET /admin/reviews` | admin |  | `{ status?: ReviewStatus }` |  | `Review[]` |
| adminModerateReview | `PATCH /admin/reviews/:id` | admin | `Id` |  | `{ status: ReviewStatus; reply?: string \| null }` | `Review` |
| adminListInquiries | `GET /admin/inquiries` | admin |  | `{ status?: InquiryStatus }` |  | `Inquiry[]` |
| adminUpdateInquiry | `PATCH /admin/inquiries/:id` | admin | `Id` |  | `{ status?: InquiryStatus; reply?: string }` | `Inquiry` |
| adminGetShippingSettings | `GET /admin/settings/shipping` | admin |  |  |  | `ShippingSettings` |
| adminUpdateShippingSettings | `PUT /admin/settings/shipping` | admin |  |  | `ShippingSettings` | `ShippingSettings` |
| adminGetPaymentSettings | `GET /admin/settings/payments` | admin |  |  |  | `PaymentSettings` |
| adminUpdatePaymentSettings | `PUT /admin/settings/payments` | admin |  |  | `PaymentSettings` | `PaymentSettings` |
| adminGetStoreSettings | `GET /admin/settings/store` | admin |  |  |  | `StoreSettings` |
| adminUpdateStoreSettings | `PUT /admin/settings/store` | admin |  |  | `Omit<StoreSettings, "logo"> & { logoId: string \| null }` | `StoreSettings` |
| adminListStaff | `GET /admin/staff` | admin |  |  |  | `Staff[]` |
| adminInviteStaff | `POST /admin/staff` | admin |  |  | `{ name: string; email: string; roleId: string }` | `Staff` |
| adminUpdateStaff | `PATCH /admin/staff/:id` | admin | `Id` |  | `Partial<Pick<Staff, "roleId" \| "status" \| "name">>` | `Staff` |
| adminRemoveStaff | `DELETE /admin/staff/:id` | admin | `Id` |  |  | `Ok` |
| adminListRoles | `GET /admin/roles` | admin |  |  |  | `Role[]` |
| adminSaveRole | `PUT /admin/roles` | admin |  |  | `Omit<Role, "id" \| "system"> & { id?: string }` | `Role` |
| adminDeleteRole | `DELETE /admin/roles/:id` | admin | `Id` |  |  | `Ok` |
