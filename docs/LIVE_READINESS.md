# Live mode readiness

Frontend: `https://queenluxuryhair.store` (canonical, from 29 Oct 2026). The old domain `queenpalacebeauty.store` is retired.
API: `https://api.queenpalacebeauty.store/v1` **for now**. The production API host for the new domain is **pending Hermes confirmation** (see "Domain change").
API status as of **28 October 2026, 17:20 UTC**; domain status as of **29 October 2026**. Re-check at any time with `npm run probe:live` (read-only).

## Where things stand

The frontend is configured for live mode (`.env.production`) and contains no route back to mock data. Live requests do **not** work yet, for reasons on the backend side:

| # | Blocker | Effect on the site | Owner |
|---|---|---|---|
| 1 | **CORS.** `OPTIONS` preflight returns `501` with no `Access-Control-Allow-Origin`. Plain responses carry `access-control-allow-credentials: true` but no allow-origin. | Every browser request (cart, checkout, account, admin, search box) is blocked by the browser. | Hermes |
| 2 | **Response shapes differ from the contract** on the endpoints that answer (details below). | Store settings and navigation can't be used, so every storefront page shows "The store is temporarily unavailable". | Hermes (or a coordinated contract change) |
| 3 | **56 of 102 endpoints return `501 not_implemented`**, and `getCart`, `removeCartLine` and `listProductReviews` return `500`. | Cart, checkout, accounts and the whole admin are unusable even after CORS is fixed. | Hermes |
| 4 | **No catalog data.** `/collections` and `/products` return empty lists. | Even with shapes fixed, the store would be empty. | Hermes / store owner |

DNS and HTTPS are fine now: `api.queenpalacebeauty.store` resolves to `162.35.31.120`, and the certificate (Let's Encrypt, issued 28 Oct 2026, valid until 26 Jan 2027) matches the hostname.

## Domain change: Queen Luxury Hair, 29 Oct 2026

The business is now **Queen Luxury Hair** at **`queenluxuryhair.store`**. The frontend uses `https://queenluxuryhair.store` as its canonical URL (`NEXT_PUBLIC_SITE_URL`), for metadata, canonical links, Open Graph, JSON-LD and `robots.txt`.

What was checked on 29 Oct 2026:

| Host | Result |
|---|---|
| `queenluxuryhair.store` | Vercel, `308` redirect to `www.queenluxuryhair.store` |
| `www.queenluxuryhair.store` | Vercel, serves the Queen Luxury Hair build in live mode, showing "The store is temporarily unavailable" (blockers below). Its share-image URLs still point at `queenpalacebeauty.store`, so `NEXT_PUBLIC_SITE_URL` in the Vercel dashboard still has the old value. |
| `api.queenluxuryhair.store` | **Came up during the day.** DNS now points to `162.35.31.120`, the backend server, and from about 23:20 UTC on 28 Oct it answers over HTTPS. Read-only probe from origin `https://queenluxuryhair.store`: CORS preflight **OK (204)**; 14 checks pass (`listCollections`, `listProducts`, customer and admin 401 gates); the same 5 shape mismatches as before (settings, navigation, homepage, payment options, search); `listProductReviews` 500; `listCustomerReviews`, `adminListReviews` and other admin endpoints 501. |
| `www.queenpalacebeauty.store` / `queenpalacebeauty.store` | `404 DEPLOYMENT_NOT_FOUND` (detached from Vercel) |
| `api.queenpalacebeauty.store` | **No longer reaches the backend.** DNS now points to Vercel addresses (`64.29.17.65`, `216.198.79.1`) and HTTPS fails. The frontend's interim value in `.env.production` therefore doesn't work either. |

So the backend appears to have moved to `https://api.queenluxuryhair.store/v1`. That is consistent with the recommendation, but it is an observation, not confirmation. **When Hermes confirms it, change one line** in `.env.production` and in Vercel (Production): `NEXT_PUBLIC_API_BASE_URL=https://api.queenluxuryhair.store/v1`, then redeploy. No code change is needed.

**Why the API host matters.** Session cookies are `SameSite=Lax`. While the storefront is on `queenluxuryhair.store` and the API is on `queenpalacebeauty.store`, the two are **cross-site**: browsers won't send the customer or staff session cookie with API requests. Sign-in, accounts, wishlist sync, My reviews and the whole admin would fail, and Safari blocks such third-party cookies even with `SameSite=None`. The build prints a warning while this is the case. The fix is an API host under the new domain, e.g. `https://api.queenluxuryhair.store/v1`, but **the frontend won't switch until Hermes confirms** the endpoint, DNS, TLS, CORS and cookie settings.

Frontend audit of the old domain (all done in code):
- **Canonical/metadata:** come only from `NEXT_PUBLIC_SITE_URL`; no hard-coded domain in `src/`.
- **Redirects:** `next.config.ts` permanently redirects `queenpalacebeauty.store` and `www.queenpalacebeauty.store` to the same path on the new domain, but only once the old domain is attached to this Vercel project again. The www-to-apex redirect must be set in Vercel's Domains settings, not in code, to avoid a loop.
- **Sign-in "next" redirects:** relative paths only (`src/lib/redirect.ts`), so the domain doesn't matter.
- **Payment return URLs and password-reset links:** built by the **backend**; the frontend sends no return URL. Hermes must update them (below).
- **Payment redirects:** the frontend follows any `https` `payment.redirectUrl` (`src/lib/checkout.ts`); there is no domain allow-list to update.
- **API configuration:** only `NEXT_PUBLIC_API_BASE_URL` (and optional `API_BASE_URL`). `npm run probe:live` now reads both URLs from `.env.production` instead of hard-coding them.
- **Remaining old-domain text:** only this document's history and the interim API URL.

## Production deployment, 28 Oct 2026 (commit `869f555`)

- Vercel built and deployed the live-mode commit to all three linked projects: `queen-palace`, `queen-palace1` and `queen-palace2`.
- `www.queenpalacebeauty.store` now runs in live mode. `/api/mock/*` answers `404 mock_disabled`. Storefront pages show "The store is temporarily unavailable" (HTTP 500), and `/admin` shows "The admin can't reach the store API".
- The deployed bundle calls `https://api.queenpalacebeauty.store` **without `/v1`**, so a Vercel dashboard value is overriding `.env.production`. Without the prefix the API answers 404; with it, 401/200. **Fix: set `NEXT_PUBLIC_API_BASE_URL=https://api.queenpalacebeauty.store/v1` in Vercel (Production) and redeploy.**
- Even with that fixed, browsers will be blocked by CORS (blocker 1), and the storefront will stay unavailable until the settings and navigation shapes match (blocker 2).

## Base URL includes `/v1`

The API serves every contract route under `/v1`: `GET /v1/store/settings` is 200, while `GET /store/settings` is 404. `docs/API_CONTRACT.md` already says the base URL includes the version. So:

`NEXT_PUBLIC_API_BASE_URL=https://api.queenpalacebeauty.store/v1`

If the version prefix should go away, that needs a coordinated change. The frontend needs no code change either way, only the variable.

## Environment variables (Vercel, Production)

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_DATA_MODE` | `live` | Already in `.env.production`. A dashboard value overrides the file, so delete or update any `mock` value set there. |
| `NEXT_PUBLIC_API_BASE_URL` | Today `https://api.queenpalacebeauty.store/v1`; after Hermes confirms, e.g. `https://api.queenluxuryhair.store/v1` | Must include `/v1`. Change it only after the backend confirms the host. |
| `NEXT_PUBLIC_SITE_URL` | `https://queenluxuryhair.store` | Canonical URL, metadata, JSON-LD and robots. The dashboard still has the old value: update it. |
| `CATALOG_REVALIDATE_SECONDS` | `60` | Optional. This is the default. |
| `NEXT_PUBLIC_MEDIA_HOSTS` | Your image CDN host(s), comma separated | Optional. The API host is allowed automatically in live mode. |
| `API_BASE_URL` | Not needed | Server code falls back to `NEXT_PUBLIC_API_BASE_URL`. Only set it to route server-side calls through a private address. |

None of these are secrets. Never put Paystack/Flutterwave secret keys, database URLs or session secrets in the frontend project: they belong to the backend.

## What the frontend does in live mode

- **One client.** `src/lib/api/client.ts` handles every request. Paths come only from `src/lib/api/contract.ts`; there are no hard-coded API URLs.
- **Cookies.** Every request sends `credentials: "include"`. Sessions are httpOnly cookies set by the API. Browser code never reads them; it keeps only a non-sensitive "signed in" hint to skip pointless requests.
- **Timeouts and retries.** Browser requests time out after 20 s, server renders after 8 s (under Vercel's limit), and checkout after 45 s. Safe GETs are retried once on network errors and 502/503/504. Mutations are never retried automatically.
- **Response checks.** Key endpoints have their responses shape-checked (`src/lib/api/validate.ts`). A mismatch raises `contract_mismatch` and logs exactly which field was wrong, instead of rendering wrong data.
- **No mock fallback.** The repository calls the real API or throws. `/api/mock` answers 404 in live mode. Demo logins, demo labels and sample-data notices only appear in mock mode.
- **Rendering and caching.** In live mode, storefront pages render at request time, so builds never call the API or bake data into HTML. API responses are cached in Next's data cache for `CATALOG_REVALIDATE_SECONDS` (60 s, tag `catalog`), so catalog changes can take up to a minute to appear. Cart, checkout, account and admin data are never cached.
- **Failures shown to users:**
  - If settings or navigation fail, shoppers see a branded "The store is temporarily unavailable" page with Try again (`src/app/error.tsx`).
  - If a page fails, they see "This page didn't load" with Try again.
  - If the admin can't reach the API, staff see "The admin can't reach the store API" with the reason and Try again.
  - The root layout keeps rendering (sign-in still loads) and falls back only to the store's name.
- **Sessions.** A 401 from any admin endpoint sends staff to sign-in with "Your session ended" and returns them to the same page afterwards. A 403 reloads the session so the menu matches the backend's permissions. A customer 401 clears the signed-in hint. Post-login redirects only accept same-site paths (`src/lib/redirect.ts`).
- **Checkout.**
  - Double submits are blocked.
  - One idempotency key covers each attempt. It is kept across timeouts and 5xx (so a retry can't create a second order) and replaced after a definite 4xx.
  - Payment redirects must be `https`.
  - Prices, discounts, shipping totals, stock and payment status are always the backend's numbers.
- **Admin saves.** Admin saves show the record the API returned. Nothing is marked saved until the API confirms it.

## Contract disagreements found on 28 Oct 2026

These endpoints answer, but not in the contract's shape. The frontend does **not** silently adapt to them: either the backend matches the contract, or we agree a contract change and update `src/lib/api/contract.ts` and the docs together.

| Endpoint | Contract (`src/lib/types`) | API returned |
|---|---|---|
| `GET /store/settings` | `StoreSettings`: `name, tagline, metaDescription, logo, logoDark, contactEmail, phone, whatsapp, address, openingHours (string\|null), currency, branding {colors, radius}, theme {defaultMode}, productPageNotes, social {instagram, tiktok, facebook}, announcement, freeShippingThreshold` | `{ name, address, currency, timezone, phone, whatsapp, email, hours: [], socials: {} }`. Missing tagline, metaDescription, branding, theme, announcement, productPageNotes and logos. `email` should be `contactEmail`, `hours` should be `openingHours`, `socials` should be `social`. |
| `GET /store/navigation` | `{ main: NavItem[], footer: { id, title, items }[] }` | `{ items: [] }` |
| `GET /store/homepage` | `{ sections: HomepageSection[], collections: Collection[], updatedAt }` | `{ sections: [] }` |
| `GET /store/payment-options` | `{ methods: { method, label, description }[] }` | `{ card: {enabled}, bankTransfer: {enabled}, payOnDelivery: {enabled} }` |
| `GET /search` | `{ query, products: ProductListing, collections, suggestions }` | `{ products: [], collections: [] }` |
| `POST /checkout/shipping-rates` | `ShippingQuote[]`, each `{ id, label, description, amount, etaDays: [min,max], totals }` | `{ rates: [{ id, label, amount, currency, estimatedDays: "3-7 business days" }] }`, with no totals |
| `POST /carts` | `Cart`: `{ id, currency, lines, itemCount, discounts, totals {subtotal, discountTotal, shippingTotal, taxTotal, total}, notices, updatedAt }` | `{ id, lines, subtotal, discountTotal, shippingTotal, total, currency }` (flat totals, no itemCount/discounts/notices) |
| Error codes | Mock uses `validation_failed`, `unauthenticated` | API uses `validation_error`, `unauthorized`. The frontend only branches on HTTP status for these, so this is **compatible**. |

Error codes the frontend **does** branch on, which the backend must use:

| Code | Status | Where | Frontend behaviour |
|---|---|---|---|
| `cart_not_found` | 404 | cart line updates | Forgets the stored cart id. |
| `cart_changed` | 409 | `POST /checkout` | Refreshes the cart and asks the shopper to review. |
| `insufficient_stock` | 409 | `POST /checkout`, cart | Refreshes the cart. |
| any 404 | 404 | `GET /carts/:id` | Starts a new cart. |

Field errors must come in `error.fields` keyed by input name (`email`, `phone`, `firstName`, `line1`, `city`, `state`, `password`, `variants.0.price`…) so they show next to the right field.

## What Hermes needs to provide or confirm

The exact request and response types for every item are in `docs/API_CONTRACT.md` and `src/lib/types/index.ts`. Business rules are in `docs/BACKEND_INTEGRATION.md`, with executable reference behaviour in `tests/mock-backend.test.ts`.

**Before anything works in a browser**
0. **Confirm the production API host for `queenluxuryhair.store`** (recommended: `api.queenluxuryhair.store`): DNS, TLS certificate, the `/v1` prefix, and the date it goes live. Until then the storefront stays on `api.queenpalacebeauty.store`, where cookies won't work cross-site (see "Domain change").
1. CORS for origins `https://queenluxuryhair.store` and `https://www.queenluxuryhair.store` (keep `*.vercel.app` previews only if you test there). Remove the old `queenpalacebeauty.store` origins once nothing uses them:
   - `Access-Control-Allow-Origin` set to the exact origin (not `*`).
   - `Access-Control-Allow-Credentials: true`.
   - `OPTIONS` answered with `204`, allowing methods `GET, POST, PUT, PATCH, DELETE` and header `Content-Type`.
   - `Vary: Origin`.
2. Session cookies: `HttpOnly; Secure; SameSite=Lax; Path=/`. Leave `Domain` unset or use `.queenluxuryhair.store`. This only works once the API is on the same site as the storefront.
2a. Backend-built URLs must use `https://queenluxuryhair.store`: Paystack/Flutterwave callback and return URLs (and the allowed callback domains in those dashboards), password-reset links, order-status links in emails, and staff invite links. Update the sender name and reply-to on emails to Queen Luxury Hair.

**To open the storefront**
3. Match the contract shapes for `GET /store/settings`, `/store/navigation`, `/store/homepage`, `/store/payment-options` and `/search` (table above).
4. Catalog data: collections and products seeded as rows (Futura Wig, Bone Straight, Factory Wigs, Braids Extensions, Hair Maintains). `GET /collections/:handle` and `GET /products/:handle` must return `CollectionWithProducts` and `ProductDetail`.
5. Image URLs in `Media.url` must be absolute `https` URLs. If they're served from a host other than the API, give us the host for `NEXT_PUBLIC_MEDIA_HOSTS`. Also note that the API currently sends `Cross-Origin-Resource-Policy: same-origin`, which would block images served from the API host on the storefront. Serve media without that header, or from a CDN.

**To sell**
6. The cart family must return the contract `Cart` shape: `POST /carts`, `GET /carts/:id` (now 500), `POST /carts/:id/lines`, `PATCH`/`DELETE /carts/:id/lines/:lineId` (DELETE now 500), and `POST`/`DELETE /carts/:id/discounts…` (now 501).
7. `POST /checkout/shipping-rates` must return `ShippingQuote[]`, each with full `totals`.
8. `POST /checkout` must be idempotent on `idempotencyKey`, and return `CheckoutResult` with `payment.redirectUrl` (https) for card payments.
9. `GET /orders/:number?token=` and `POST /orders/track` must return `Order`, and `POST /orders/:number/verify-payment` (now 501) must re-query the provider. Paystack/Flutterwave webhooks must be signature-verified.
10. Customer reviews, as specified in **`docs/REVIEWS_API.md`**: `GET /products/:id/reviews` (now 500) with optional `sort` and `summary`; `POST /products/:id/reviews` returning `{ id, status, createdAt }`; the new `GET /customers/me/reviews`; and admin moderation with statuses `pending | approved | rejected` and `rejectionReason`.

**Accounts**
11. Register, login, logout and session. Password reset request and confirm (now 501). `GET/PUT/DELETE /customers/me/addresses`, `GET/PUT /customers/me/wishlist`, `GET /customers/me/orders`.

**Admin (all 501 today unless marked)**
12. Sign-in, session and logout, then every admin endpoint in `docs/API_CONTRACT.md`, each enforcing its permission from `docs/BACKEND_INTEGRATION.md`. These already answer 401 without a session, which is a good sign but not confirmation: dashboard, products list and detail, product create and delete, inventory list and adjust, collections list, orders list. Not implemented yet:
    - product update and duplicate, product types, variants
    - collections create, update, delete and reorder
    - media
    - order detail and fulfilment, transfer, cancel, refund and notes
    - homepage, navigation and pages
    - customers, analytics and search
    - discounts, reviews and inquiries
    - shipping, payment and store settings
    - staff and roles

Two contract endpoints aren't used by the current UI and are optional: `GET /customers/me` (`getCustomerAccount`) and `PATCH /admin/products/:productId/variants/:variantId` (`adminUpdateVariant`).

## Feature readiness

The frontend implements every feature below against the contract. "Backend" is what the 28 Oct probe could see.

| Area | Feature | Data source in live mode | Endpoints | Frontend | Backend |
|---|---|---|---|---|---|
| Store | Layout, header, footer, theme default | Server render | `getStoreSettings`, `getNavigation` | Ready | ⚠️ shapes differ |
| Store | Homepage sections | Server render | `getHomepage` | Ready | ⚠️ shape differs, no content |
| Store | Collections list and pages, filters, sort, in-collection search, pagination | Server render (60 s cache) | `listCollections`, `getCollection` | Ready | 🟡 list OK but empty, detail unconfirmed |
| Store | Product page, variants, SKU, stock, video, related | Server render | `getProduct`, `listProductReviews`, `createProductReview` | Ready | ❌ reviews 500, product unconfirmed |
| Store | Search page and search box suggestions | Server + browser | `search`, `listProducts` | Ready | ⚠️ search shape differs |
| Store | Cart drawer and cart page, discounts | Browser, cart id in localStorage | `createCart`, `getCart`, `addCartLines`, `updateCartLine`, `removeCartLine`, `applyDiscount`, `removeDiscount` | Ready | ❌ shape differs, 500s and 501s |
| Store | Checkout: delivery quote, payment methods, place order | Browser + server | `getShippingRates`, `getPaymentOptions`, `placeOrder` | Ready | ⚠️ shapes differ, success path unconfirmed |
| Store | Order confirmation, payment verification, tracking | Browser | `getOrder`, `verifyPayment`, `trackOrder` | Ready | ❌ verify 501, others unconfirmed |
| Store | Register, sign in, sign out, password reset | Browser | `customerRegister`, `customerLogin`, `customerLogout`, `getCustomer`, `customerRequestPasswordReset`, `customerResetPassword` | Ready | 🟡 login/register validate input; reset 501 |
| Store | Order history, saved addresses, wishlist sync | Browser | `listCustomerOrders`, `listAddresses`, `saveAddress`, `deleteAddress`, `getWishlist`, `replaceWishlist` | Ready | 🟡 auth-gated, unconfirmed |
| Store | Contact form, newsletter | Browser | `createInquiry`, `subscribeNewsletter` | Ready | 🟡 validate input, unconfirmed |
| Admin | Sign-in, session expiry, permission-aware menus | Browser | `adminLogin`, `adminSession`, `adminLogout` | Ready | 🟡 auth-gated, unconfirmed |
| Admin | Dashboard | Browser | `adminDashboard` | Ready | 🟡 auth-gated |
| Admin | Analytics, global search | Browser | `adminAnalytics`, `adminSearch` | Ready | ❌ 501 |
| Admin | Products, duplicate, product types | Browser | `adminListProducts`, `adminGetProduct`, `adminCreateProduct`, `adminUpdateProduct`, `adminDuplicateProduct`, `adminDeleteProduct`, `adminListProductTypes`, `adminSaveProductType`, `adminDeleteProductType` | Ready | Partly 🟡, update/duplicate/types ❌ 501 |
| Admin | Inventory | Browser | `adminListInventory`, `adminAdjustInventory` | Ready | 🟡 auth-gated |
| Admin | Collections | Browser | `adminListCollections`, `adminCreateCollection`, `adminUpdateCollection`, `adminDeleteCollection`, `adminReorderCollections` | Ready | List 🟡, writes ❌ 501 |
| Admin | Media library | Browser | `adminListMedia`, `adminUploadMedia`, `adminUpdateMedia`, `adminDeleteMedia` | Ready | ❌ 501 |
| Admin | Orders: fulfil, confirm transfer, cancel, refund, notes | Browser | `adminListOrders`, `adminGetOrder`, `adminUpdateFulfillment`, `adminMarkTransferReceived`, `adminCancelOrder`, `adminRefundOrder`, `adminAddOrderNote` | Ready | List 🟡, the rest ❌ 501 |
| Admin | Customers, messages, reviews | Browser | `adminListCustomers`, `adminGetCustomer`, `adminListInquiries`, `adminUpdateInquiry`, `adminListReviews`, `adminModerateReview` | Ready | ❌ 501 |
| Admin | Discounts | Browser | `adminListDiscounts`, `adminCreateDiscount`, `adminUpdateDiscount`, `adminDeleteDiscount` | Ready | ❌ 501 |
| Admin | Homepage, navigation, pages | Browser | `adminGetHomepage`, `adminUpdateHomepage`, `adminGetNavigation`, `adminUpdateNavigation`, `adminListPages`, `adminSavePage` | Ready | ❌ 501 |
| Admin | Branding and store, shipping and payments | Browser | `adminGetStoreSettings`, `adminUpdateStoreSettings`, `adminGetShippingSettings`, `adminUpdateShippingSettings`, `adminGetPaymentSettings`, `adminUpdatePaymentSettings` | Ready | ❌ 501 |
| Admin | Staff and roles | Browser | `adminListStaff`, `adminInviteStaff`, `adminUpdateStaff`, `adminRemoveStaff`, `adminListRoles`, `adminSaveRole`, `adminDeleteRole` | Ready | ❌ 501 |

## API compatibility matrix (all 103 endpoints)

How the "Backend" column was filled: GETs come from `npm run probe:live`, read-only. Mutations were sent an empty `{}` body once, on 28 Oct, only to tell "validates input" (400) from "not implemented" (501); this created two empty carts and nothing else. **No row is "confirmed".** A backend endpoint counts as confirmed only after a real request with real data succeeds end to end, which still needs Hermes's tests and a live session.

Legend: ❌ not working · ⚠️ answers in a different shape · 🟡 answers, but correct behaviour not confirmed · ✅ frontend implemented.

| Endpoint | Method and path | Frontend feature | Request (params / query / body) | Response | Auth | Frontend | Backend (probe 28 Oct 2026) |
|---|---|---|---|---|---|---|---|
| getStoreSettings | `GET /store/settings` | Storefront pages (server) | – / – / – | `StoreSettings` | public | ✅ implemented | ⚠️ responds, shape mismatch |
| getNavigation | `GET /store/navigation` | Storefront pages (server) | – / – / – | `Navigation` | public | ✅ implemented | ⚠️ responds, shape mismatch |
| getHomepage | `GET /store/homepage` | Storefront pages (server) | – / – / – | `Homepage` | public | ✅ implemented | ⚠️ responds, shape mismatch |
| getContentPage | `GET /store/pages/:slug` | Storefront pages (server) | `{ slug: string }` / – / – | `ContentPage` | public | ✅ implemented | 🟡 404 for probe id; unconfirmed |
| getPaymentOptions | `GET /store/payment-options` | Storefront pages (server) | – / – / – | `PublicPaymentOptions` | public | ✅ implemented | ⚠️ responds, shape mismatch |
| listCollections | `GET /collections` | Storefront pages (server) | – / – / – | `Collection[]` | public | ✅ implemented | 🟡 responds, shape OK (empty); not confirmed with data |
| getCollection | `GET /collections/:handle` | Storefront pages (server) | `{ handle: string }` / `Omit<ProductQuery, "collection" \| "options"> & { options?: string }` / – | `CollectionWithProducts` | public | ✅ implemented | 🟡 404 for probe id; unconfirmed |
| listProducts | `GET /products` | Customer account, Storefront pages (server) | – / `Omit<ProductQuery, "options"> & { options?: string; ids?: string }` / – | `ProductListing` | public | ✅ implemented | 🟡 responds, shape OK (empty); not confirmed with data |
| getProduct | `GET /products/:handle` | Storefront pages (server) | `{ handle: string }` / – / – | `ProductDetail` | public | ✅ implemented | 🟡 404 for probe id; unconfirmed |
| listProductReviews | `GET /products/:productId/reviews` | Product reviews (server; a failure no longer takes the product page down) | `{ productId: string }` / `{ page?: number; sort?: ReviewSort }` / – | `ReviewPage` (optional `summary`) | public | ✅ implemented | ❌ 500 internal_error |
| createProductReview | `POST /products/:productId/reviews` | Product reviews | `{ productId: string }` / – / `ReviewInput` | `ReviewSubmission` `{ id, status, createdAt }` | public (links session if present) | ✅ implemented | 🟡 validates input (400 validation_error, contract says 422); success shape changed 29 Oct, unconfirmed |
| search | `GET /search` | Search, Storefront pages (server), Admin search, Admin media, Admin orders, Admin customers, Admin inventory, Admin products | – / `{ q: string; page?: number }` / – | `SearchResult` | public | ✅ implemented | ⚠️ responds, shape mismatch |
| createCart | `POST /carts` | Cart | – / – / `{ lines?: AddCartLineInput[] }` | `Cart` | public | ✅ implemented | ⚠️ responds, shape mismatch |
| getCart | `GET /carts/:cartId` | Cart | `{ cartId: string }` / – / – | `Cart` | public | ✅ implemented | ❌ 500 internal_error |
| addCartLines | `POST /carts/:cartId/lines` | Cart | `{ cartId: string }` / – / `{ lines: AddCartLineInput[] }` | `Cart` | public | ✅ implemented | 🟡 validates input (400 validation_error); success path unconfirmed |
| updateCartLine | `PATCH /carts/:cartId/lines/:lineId` | Cart | `{ cartId: string; lineId: string }` / – / `{ quantity: number }` | `Cart` | public | ✅ implemented | 🟡 validates input (400 validation_error); success path unconfirmed |
| removeCartLine | `DELETE /carts/:cartId/lines/:lineId` | Cart | `{ cartId: string; lineId: string }` / – / – | `Cart` | public | ✅ implemented | ❌ 500 internal_error |
| applyDiscount | `POST /carts/:cartId/discounts` | Cart | `{ cartId: string }` / – / `{ code: string }` | `Cart` | public | ✅ implemented | ❌ 501 not implemented |
| removeDiscount | `DELETE /carts/:cartId/discounts/:code` | Cart | `{ cartId: string; code: string }` / – / – | `Cart` | public | ✅ implemented | ❌ 501 not implemented |
| getShippingRates | `POST /checkout/shipping-rates` | Checkout | – / – / `ShippingRatesInput` | `ShippingQuote[]` | public | ✅ implemented | ⚠️ responds, shape mismatch |
| placeOrder | `POST /checkout` | Checkout | – / – / `CheckoutInput` | `CheckoutResult` | public | ✅ implemented | 🟡 validates input (400 validation_error); success path unconfirmed |
| getOrder | `GET /orders/:number` | Order confirmation / tracking | `{ number: string }` / `{ token: string }` / – | `Order` | public | ✅ implemented | 🟡 404 for probe id; unconfirmed |
| trackOrder | `POST /orders/track` | Order confirmation / tracking | – / – / `OrderTrackingInput` | `Order` | public | ✅ implemented | 🟡 validates input (400 validation_error); success path unconfirmed |
| verifyPayment | `POST /orders/:number/verify-payment` | Order confirmation / tracking | `{ number: string }` / – / `{ token: string; reference?: string }` | `Order` | public | ✅ implemented | ❌ 501 not implemented |
| createInquiry | `POST /inquiries` | Contact form | – / – / `InquiryInput` | `{ id: string; status: "new" }` | public | ✅ implemented | 🟡 validates input (400 validation_error); success path unconfirmed |
| subscribeNewsletter | `POST /newsletter` | Newsletter | – / – / `{ email: string }` | `Ok` | public | ✅ implemented | 🟡 validates input (400 validation_error); success path unconfirmed |
| customerLogin | `POST /customers/auth/login` | Customer account | – / – / `{ email: string; password: string }` | `CustomerSession` | public | ✅ implemented | 🟡 validates input (400 validation_error); success path unconfirmed |
| customerLogout | `POST /customers/auth/logout` | Customer account | – / – / – | `Ok` | customer | ✅ implemented | 🟡 responds 200; not confirmed |
| getCustomer | `GET /customers/me/session` | Checkout, Customer account | – / – / – | `CustomerSession` | customer | ✅ implemented | 🟡 auth-gated (401); behaviour unconfirmed |
| getCustomerAccount | `GET /customers/me` | not used by the UI yet | – / – / – | `Customer` | customer | ➖ contract only | 🟡 auth-gated (401); behaviour unconfirmed |
| listCustomerOrders | `GET /customers/me/orders` | Customer account | – / – / – | `OrderSummary[]` | customer | ✅ implemented | 🟡 auth-gated (401); behaviour unconfirmed |
| listCustomerReviews | `GET /customers/me/reviews` | Account, My reviews | – / – / – | `Review[]` (with `rejectionReason`) | customer | ✅ implemented (new 29 Oct) | ❓ new endpoint, not probed |
| getWishlist | `GET /customers/me/wishlist` | Wishlist | – / – / – | `Wishlist` | customer | ✅ implemented | 🟡 auth-gated (401); behaviour unconfirmed |
| customerRegister | `POST /customers/auth/register` | Customer account | – / – / `CustomerRegisterInput` | `CustomerSession` | public | ✅ implemented | 🟡 validates input (400 validation_error); success path unconfirmed |
| customerRequestPasswordReset | `POST /customers/auth/password-reset` | Customer account | – / – / `{ email: string }` | `Ok` | public | ✅ implemented | ❌ 501 not implemented |
| customerResetPassword | `POST /customers/auth/password-reset/confirm` | Customer account | – / – / `{ token: string; password: string }` | `Ok` | public | ✅ implemented | ❌ 501 not implemented |
| listAddresses | `GET /customers/me/addresses` | Checkout, Customer account | – / – / – | `SavedAddress[]` | customer | ✅ implemented | 🟡 auth-gated (401); behaviour unconfirmed |
| saveAddress | `PUT /customers/me/addresses` | Customer account | – / – / `Omit<SavedAddress, "id"> & { id?: string }` | `SavedAddress[]` | customer | ✅ implemented | 🟡 auth-gated (401); behaviour unconfirmed |
| deleteAddress | `DELETE /customers/me/addresses/:id` | Customer account | `Id` / – / – | `SavedAddress[]` | customer | ✅ implemented | 🟡 auth-gated (401); behaviour unconfirmed |
| replaceWishlist | `PUT /customers/me/wishlist` | Wishlist | – / – / `Wishlist` | `Wishlist` | customer | ✅ implemented | 🟡 auth-gated (401); behaviour unconfirmed |
| adminLogin | `POST /admin/auth/login` | Admin sign-in | – / – / `AdminLoginInput` | `AdminSession` | public | ✅ implemented | 🟡 validates input (400 validation_error); success path unconfirmed |
| adminLogout | `POST /admin/auth/logout` | Admin session | – / – / – | `Ok` | admin | ✅ implemented | 🟡 responds 200; not confirmed |
| adminSession | `GET /admin/auth/session` | Admin session | – / – / – | `AdminSession` | admin | ✅ implemented | 🟡 auth-gated (401); behaviour unconfirmed |
| adminDashboard | `GET /admin/dashboard` | Admin dashboard, Admin page | – / `{ days?: number }` / – | `DashboardSummary` | admin | ✅ implemented | 🟡 auth-gated (401); behaviour unconfirmed |
| adminListProducts | `GET /admin/products` | Admin products | – / `AdminProductQuery` / – | `Paginated<Product>` | admin | ✅ implemented | 🟡 auth-gated (401); behaviour unconfirmed |
| adminGetProduct | `GET /admin/products/:id` | Admin products | `Id` / – / – | `Product` | admin | ✅ implemented | 🟡 auth-gated (401); behaviour unconfirmed |
| adminCreateProduct | `POST /admin/products` | Admin products | – / – / `ProductInput` | `Product` | admin | ✅ implemented | 🟡 auth-gated (401); behaviour unconfirmed |
| adminUpdateProduct | `PUT /admin/products/:id` | Admin products | `Id` / – / `ProductInput` | `Product` | admin | ✅ implemented | ❌ 501 not implemented |
| adminDeleteProduct | `DELETE /admin/products/:id` | Admin products | `Id` / – / – | `Ok` | admin | ✅ implemented | 🟡 auth-gated (401); behaviour unconfirmed |
| adminDuplicateProduct | `POST /admin/products/:id/duplicate` | Admin products | `Id` / – / – | `Product` | admin | ✅ implemented | ❌ 501 not implemented |
| adminListProductTypes | `GET /admin/product-types` | Admin product types, Admin products | – / – / – | `ProductType[]` | admin | ✅ implemented | ❌ 501 not implemented |
| adminSaveProductType | `PUT /admin/product-types` | Admin product types | – / – / `ProductTypeInput` | `ProductType` | admin | ✅ implemented | ❌ 501 not implemented |
| adminDeleteProductType | `DELETE /admin/product-types/:id` | Admin product types | `Id` / – / – | `Ok` | admin | ✅ implemented | ❌ 501 not implemented |
| adminUpdateVariant | `PATCH /admin/products/:productId/variants/:variantId` | not used by the UI yet | `{ productId: string; variantId: string }` / – / `Partial<Pick<Variant, "price" \| "compareAtPrice" \| "sku">>` | `Variant` | admin | ➖ contract only | ❌ 501 not implemented |
| adminListInventory | `GET /admin/inventory` | Admin inventory | – / `{ q?: string; lowOnly?: boolean }` / – | `InventoryRow[]` | admin | ✅ implemented | 🟡 auth-gated (401); behaviour unconfirmed |
| adminAdjustInventory | `POST /admin/inventory/adjustments` | Admin inventory | – / – / `InventoryAdjustment` | `InventoryRow` | admin | ✅ implemented | 🟡 auth-gated (401); behaviour unconfirmed |
| adminListCollections | `GET /admin/collections` | Admin navigation, Admin discounts, Admin storefront, Admin products, Admin collections | – / – / – | `Collection[]` | admin | ✅ implemented | 🟡 auth-gated (401); behaviour unconfirmed |
| adminCreateCollection | `POST /admin/collections` | Admin collections | – / – / `CollectionInput` | `Collection` | admin | ✅ implemented | ❌ 501 not implemented |
| adminUpdateCollection | `PATCH /admin/collections/:id` | Admin collections | `Id` / – / `Partial<CollectionInput>` | `Collection` | admin | ✅ implemented | ❌ 501 not implemented |
| adminDeleteCollection | `DELETE /admin/collections/:id` | Admin collections | `Id` / – / – | `{ ok: true; unassignedProductIds: string[] }` | admin | ✅ implemented | ❌ 501 not implemented |
| adminReorderCollections | `PUT /admin/collections/order` | Admin collections | – / – / `{ ids: string[] }` | `Collection[]` | admin | ✅ implemented | ❌ 501 not implemented |
| adminListMedia | `GET /admin/media` | Admin media | – / `{ q?: string }` / – | `Media[]` | admin | ✅ implemented | ❌ 501 not implemented |
| adminUploadMedia | `POST /admin/media` | Admin media | – / – / `Upload` | `Media` | admin | ✅ implemented | ❌ 501 not implemented |
| adminUpdateMedia | `PATCH /admin/media/:id` | Admin media | `Id` / – / `Pick<Media, "alt" \| "tags">` | `Media` | admin | ✅ implemented | ❌ 501 not implemented |
| adminDeleteMedia | `DELETE /admin/media/:id` | Admin media | `Id` / – / – | `Ok` | admin | ✅ implemented | ❌ 501 not implemented |
| adminListOrders | `GET /admin/orders` | Admin orders | – / `AdminOrderQuery` / – | `Paginated<OrderSummary>` | admin | ✅ implemented | 🟡 auth-gated (401); behaviour unconfirmed |
| adminGetOrder | `GET /admin/orders/:id` | Admin orders | `Id` / – / – | `Order` | admin | ✅ implemented | ❌ 501 not implemented |
| adminUpdateFulfillment | `POST /admin/orders/:id/fulfillment` | Admin orders | `Id` / – / `FulfillmentUpdate` | `Order` | admin | ✅ implemented | ❌ 501 not implemented |
| adminMarkTransferReceived | `POST /admin/orders/:id/transfer-received` | Admin orders | `Id` / – / `{ reference: string; note?: string }` | `Order` | admin | ✅ implemented | ❌ 501 not implemented |
| adminCancelOrder | `POST /admin/orders/:id/cancel` | Admin orders | `Id` / – / `{ reason: string; restock: boolean }` | `Order` | admin | ✅ implemented | ❌ 501 not implemented |
| adminRefundOrder | `POST /admin/orders/:id/refunds` | Admin orders | `Id` / – / `{ amount: number; reason: string }` | `Order` | admin | ✅ implemented | ❌ 501 not implemented |
| adminAddOrderNote | `POST /admin/orders/:id/notes` | Admin orders | `Id` / – / `{ message: string }` | `Order` | admin | ✅ implemented | ❌ 501 not implemented |
| adminGetHomepage | `GET /admin/content/homepage` | Admin storefront | – / – / – | `Homepage` | admin | ✅ implemented | ❌ 501 not implemented |
| adminUpdateHomepage | `PUT /admin/content/homepage` | Admin storefront | – / – / `{ sections: HomepageSection[] }` | `Homepage` | admin | ✅ implemented | ❌ 501 not implemented |
| adminGetNavigation | `GET /admin/content/navigation` | Admin navigation | – / – / – | `Navigation` | admin | ✅ implemented | ❌ 501 not implemented |
| adminUpdateNavigation | `PUT /admin/content/navigation` | Admin navigation | – / – / `Navigation` | `Navigation` | admin | ✅ implemented | ❌ 501 not implemented |
| adminListPages | `GET /admin/pages` | Admin pages | – / – / – | `ContentPageT[]` | admin | ✅ implemented | ❌ 501 not implemented |
| adminSavePage | `PUT /admin/pages/:slug` | Admin pages | `{ slug: string }` / – / `Omit<ContentPageT, "slug" \| "updatedAt">` | `ContentPageT` | admin | ✅ implemented | ❌ 501 not implemented |
| adminListCustomers | `GET /admin/customers` | Admin customers | – / `{ q?: string; page?: number; pageSize?: number }` / – | `Paginated<CustomerSummary>` | admin | ✅ implemented | ❌ 501 not implemented |
| adminGetCustomer | `GET /admin/customers/:id` | Admin customers | `Id` / – / – | `CustomerDetail` | admin | ✅ implemented | ❌ 501 not implemented |
| adminAnalytics | `GET /admin/analytics` | Admin analytics | – / `{ days?: number }` / – | `AnalyticsReport` | admin | ✅ implemented | ❌ 501 not implemented |
| adminSearch | `GET /admin/search` | Admin search | – / `{ q: string }` / – | `AdminSearchResult` | admin | ✅ implemented | ❌ 501 not implemented |
| adminListDiscounts | `GET /admin/discounts` | Admin discounts | – / – / – | `Discount[]` | admin | ✅ implemented | ❌ 501 not implemented |
| adminCreateDiscount | `POST /admin/discounts` | Admin discounts | – / – / `DiscountInput` | `Discount` | admin | ✅ implemented | ❌ 501 not implemented |
| adminUpdateDiscount | `PUT /admin/discounts/:id` | Admin discounts | `Id` / – / `DiscountInput` | `Discount` | admin | ✅ implemented | ❌ 501 not implemented |
| adminDeleteDiscount | `DELETE /admin/discounts/:id` | Admin discounts | `Id` / – / – | `Ok` | admin | ✅ implemented | ❌ 501 not implemented |
| adminListReviews | `GET /admin/reviews` | Admin reviews | – / `{ status?: "pending" \| "approved" \| "rejected" }` / – | `Review[]` | admin | ✅ implemented | ❌ 501 not implemented |
| adminModerateReview | `PATCH /admin/reviews/:id` | Admin reviews | `Id` / – / `{ status; reply?; rejectionReason? }` | `Review` | admin | ✅ implemented | ❌ 501 not implemented |
| adminListInquiries | `GET /admin/inquiries` | Admin inquiries | – / `{ status?: InquiryStatus }` / – | `Inquiry[]` | admin | ✅ implemented | ❌ 501 not implemented |
| adminUpdateInquiry | `PATCH /admin/inquiries/:id` | Admin inquiries | `Id` / – / `{ status?: InquiryStatus; reply?: string }` | `Inquiry` | admin | ✅ implemented | ❌ 501 not implemented |
| adminGetShippingSettings | `GET /admin/settings/shipping` | Admin settings | – / – / – | `ShippingSettings` | admin | ✅ implemented | ❌ 501 not implemented |
| adminUpdateShippingSettings | `PUT /admin/settings/shipping` | Admin settings | – / – / `ShippingSettings` | `ShippingSettings` | admin | ✅ implemented | ❌ 501 not implemented |
| adminGetPaymentSettings | `GET /admin/settings/payments` | Admin settings | – / – / – | `PaymentSettings` | admin | ✅ implemented | ❌ 501 not implemented |
| adminUpdatePaymentSettings | `PUT /admin/settings/payments` | Admin settings | – / – / `PaymentSettings` | `PaymentSettings` | admin | ✅ implemented | ❌ 501 not implemented |
| adminGetStoreSettings | `GET /admin/settings/store` | Admin settings | – / – / – | `StoreSettings` | admin | ✅ implemented | ❌ 501 not implemented |
| adminUpdateStoreSettings | `PUT /admin/settings/store` | Admin settings | – / – / `Omit<StoreSettings, "logo" \| "logoDark"> & { logoId: string \| null; logoDarkId: string \| null }` | `StoreSettings` | admin | ✅ implemented | ❌ 501 not implemented |
| adminListStaff | `GET /admin/staff` | Admin staff | – / – / – | `Staff[]` | admin | ✅ implemented | ❌ 501 not implemented |
| adminInviteStaff | `POST /admin/staff` | Admin staff | – / – / `{ name: string; email: string; roleId: string }` | `Staff` | admin | ✅ implemented | ❌ 501 not implemented |
| adminUpdateStaff | `PATCH /admin/staff/:id` | Admin staff | `Id` / – / `Partial<Pick<Staff, "roleId" \| "status" \| "name">>` | `Staff` | admin | ✅ implemented | ❌ 501 not implemented |
| adminRemoveStaff | `DELETE /admin/staff/:id` | Admin staff | `Id` / – / – | `Ok` | admin | ✅ implemented | ❌ 501 not implemented |
| adminListRoles | `GET /admin/roles` | Admin staff | – / – / – | `Role[]` | admin | ✅ implemented | ❌ 501 not implemented |
| adminSaveRole | `PUT /admin/roles` | Admin staff | – / – / `Omit<Role, "id" \| "system"> & { id?: string }` | `Role` | admin | ✅ implemented | ❌ 501 not implemented |
| adminDeleteRole | `DELETE /admin/roles/:id` | Admin staff | `Id` / – / – | `Ok` | admin | ✅ implemented | ❌ 501 not implemented |


**Required tests per endpoint (backend side):**
- correct shape for a success response;
- the documented error `code`, `message` and `fields` for invalid input;
- 401 without a session and 403 without the permission (admin);
- idempotency on `POST /checkout`;
- CORS headers for the storefront origin.

`npm run probe:live` covers shapes for public GETs, 401s and CORS. The rest needs backend tests or a staging session.

## Launch checklist

1. **Hermes:** confirm the API host for `queenluxuryhair.store`, fix CORS and cookies for the new origins, match the shapes above, implement the 501 endpoints the storefront needs (cart, checkout, orders, payments), and seed the catalog.
2. **Check:** run `npm run probe:live` until it reports no ❌ for the storefront endpoints and CORS is OK.
3. **Staging test:** with live settings on a Vercel preview deployment, run one real order per payment method with a test card or small amount. Confirm the webhook marks it paid, the confirmation page shows the backend's status, and the admin sees it.
4. **Vercel:** set the variables above for Production (removing any dashboard value of `mock`) and redeploy.
5. **After deploy:** load the home, collection, product and checkout pages; sign in to the admin; and watch Vercel function logs for `[api] … shape` or `network_error` lines.
6. **Rollback:** set `NEXT_PUBLIC_DATA_MODE=mock` in Vercel and redeploy. The site then shows the labelled demo store again. This is only for showing the design, never for taking orders.

## Tests: what is mocked and what is real

| Suite | Runs against | What it proves |
|---|---|---|
| `npm test` → `tests/api-client.test.ts` | Stubbed `fetch` | URL building, cookies sent, error envelope, 501 handling, non-JSON, shape mismatch, timeout, GET retry and no mutation retry, 401/403 reporting, safe redirects, payment redirect and idempotency key rules |
| `npm test` → `tests/live-mode.test.ts` | Stubbed `fetch`, live env | Live mode targets the configured API, failures throw (no mock data), `/api/mock` is disabled, a missing URL is an error |
| `npm test` → `tests/mock-backend.test.ts` | In-memory mock backend | Business rules the real backend must follow, including the admin 401 sweep, 403s, save-then-read and expired sessions |
| `npm run smoke`, `npm run e2e` | Mock-mode production build | Full routes, checkout, accounts and admin flows in the browser |
| `npm run probe:live` | **Real API**, read-only | Current backend availability, shapes and CORS |

Nothing has been verified end to end against the real backend yet, because the blockers above prevent it.
