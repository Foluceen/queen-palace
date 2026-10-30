# Backend handoff for Hermes: admin integration, 29 Oct 2026

**Ownership.** Hermes implements persistence and backend endpoints. The frontend integrates against the contract and adapts equivalent formats (`src/lib/api/normalize.ts`). Neither side changes the contract without agreeing first.

**Contract.** Every request and response type is in `docs/API_CONTRACT.md` (routes and type names) and `src/lib/types/index.ts` (field definitions). Reference behaviour (validation, status codes, permissions) is executable in `src/lib/mock/backend.ts` and `tests/mock-backend.test.ts`.

**Error format, for every endpoint:**
- Body: `{ "error": { "code", "message", "fields"? } }`.
- Status codes: 400/422 validation (with `fields`), 401 not signed in, 403 missing permission, 404 not found, 409 conflict, 429 rate limited, 5xx only for real faults.
- Unimplemented endpoints should keep returning `501 not_implemented`. The admin shows that message as is; it never fakes success.

## How this was measured
All 103 contract endpoints were probed on **29 Oct 2026 at 09:33 UTC** against `https://api.queenluxuryhair.store/v1`, **without credentials**:
- `GET` requests as they are; mutations with an empty `{}` body.
- Public endpoints that would create real records (`createCart`, `placeOrder`, `createInquiry`, `subscribeNewsletter`, `customerRegister`, `createProductReview`, password reset, logins) were not called.
- Unimplemented routes answer `501` before authentication. Implemented routes answer `401` first, so **a 401 below means "auth-gated, behaviour not yet confirmed"**. The owner's signed-in check (end of this document) confirms those.

| Result | Count |
|---|---|
| 501 `not_implemented` | **44** |
| 401 (auth first) | 30 |
| 200 / 404 / 400 as expected | 19 |
| 500 `internal_error` | 1 (`GET /products/:id/reviews` for an unknown product, should be 404) |
| Not called (would create data) | 9 |

**Fixed since this morning:**
- CORS allows `PUT`/`PATCH`/`DELETE`.
- Unknown carts and lines return **404** (was 500).
- `PUT /admin/products/:id` and `DELETE /admin/products/:id` now answer **401** without a session (were 501 and 500).
- Owner sign-in and dashboard work.

## Update, 29 Oct 2026 ~10:30 UTC: upload fix applied, contract review of `server.ts`
Hermes's upload package (`7f629fa` → `7f06423`) was applied to the frontend:
- `api.queenluxuryhair.store` is always allowed for images.
- The client rejects anything other than JPEG/PNG/WebP/AVIF, or over 3,000,000 bytes, before any request.
- `backend/` snapshots are excluded from the typecheck. The `include` was **not** narrowed to `src/`, so `tests/` and `scripts/` stay type-checked.

Reading the deployed `backend/src/server.ts`, 67 of 103 contract endpoints are implemented. Divergences found, and how each is handled:

| Area | Backend does | Frontend now | Hermes, please |
|---|---|---|---|
| Product create/update | Requires top-level `price` (single price/stock per product; default variant) | Sends `price`, `compareAtPrice`, `sku` from the first option, and `stock` on create only. Shows a notice when more than one option is entered (only the first is stored). | Decide whether multi-option products (length/density) are needed. If so, persist `variants[]` as in `ProductInput`. |
| Handles | `handle` required, `^[a-z0-9-]+$` | Generates it from the title when left empty (product and collection) | — |
| Add to bag | Reads `productId` (or treats `variantId` as a product id) | Sends `productId` alongside `variantId` | Accept the variant id from `product.variants[].id` too |
| Inventory | Rows `{productId, handle, title, sku, available}`; adjust by `productId` | Maps rows to `InventoryRow`; sends `productId` with adjustments | — |
| `DELETE /admin/products/:id` | **Archives** instead of deleting | Unchanged: the UI says "deleted", but the product reappears as archived | Delete for real (or tell us to relabel the action "Archive") |
| `GET /admin/dashboard` | `{orders:{total,pending}, revenue:{total,currency}, customers, products}` with **hard-coded zeros** | Shows the format-mismatch message (no crash, no invented numbers) | Return `DashboardSummary` computed from real orders |
| Collections | `imageId`/`bannerId` ignored (`image: null`) | — | Persist collection images when convenient |
| `POST /admin/orders/:id/notes` | Returns `{order}` | — | Return `Order` (contract) |
| Fulfilment | Also `PATCH …/fulfillment` with `{status}` | Contract is `POST …/fulfillment` with `FulfillmentUpdate` | Keep the POST contract |
| `/store/payment-options` | `{methods: []}` | Checkout shows no payment method | Return the enabled methods before taking orders |

## Upload "We couldn't reach the store": root cause (29 Oct 2026 ~11:00 UTC)
**nginx in front of the API still has the default `client_max_body_size 1m`.** Measured with unauthenticated `POST /v1/admin/media` bodies:
- up to 900 KB reaches Fastify (JSON 401 with CORS headers);
- **1,100 KB and above gets nginx `413 Request Entity Too Large` (text/html) with no `Access-Control-Allow-Origin`.**

The browser hides a CORS-less response from the page, so `fetch` rejects and the admin shows "We couldn't reach the store". Raising Fastify's `bodyLimit` to 8 MB doesn't help while nginx stops the request first. A 68-byte test image never reaches the limit, which is why the diagnostic upload succeeded.

Backend fix (Hermes), in the nginx `server` block for `api.queenluxuryhair.store`:
```nginx
client_max_body_size 8m;
```
Ideally also make nginx's own error responses carry CORS headers, so the browser shows the real status, e.g. `add_header Access-Control-Allow-Origin $http_origin always;` scoped to the allowed origins. Then `nginx -t && systemctl reload nginx`.

Frontend fix (deployed): the media page now resizes images to at most 2000 px and re-encodes them as WebP (JPEG fallback) until the image is at most 700 KB, so the base64 JSON stays under 1 MB even with the current nginx limit. Originals up to 20 MB are accepted. What is sent (`mimeType`, `sizeBytes`, `fileName`) describes the re-encoded bytes exactly, so the backend's decoded-size check holds. The upload timeout is 60 s.

## Homepage 500 after the first product was published (30 Oct 2026)
Root cause: product listings (`/products`, `/collections/:handle`, `/search`, homepage rails, `related`) return full `Product` objects where the contract expects `ProductCard` (`image`, `hoverImage`, `badges`, `swatches`). With the first published product, the home page's "New in" card read `badges.length` and the server render crashed (digest 3584312020). It was not a stale build or the Vercel cache: it reproduces locally the moment a product exists.

Frontend fix (deployed): `toProductCard` in `src/lib/api/normalize.ts` derives cards from products (first/second image, "Sold out" from availability, "Sale" from compare-at above price, first option as swatches). Listing validation now checks card fields, so a future mismatch is caught at fetch, never in render. If the list can't be loaded, the home page omits that section instead of saying "being added".

Hermes: returning `ProductCard[]` for listings, as in the contract, would also be fine; the adapter passes contract cards through unchanged.

**Seeded branding overrides the client palette.** `/store/settings` now returns `branding.colors` `{gold: "#c8a96b", burgundy: "#5a1020", …}` and `radius: 12`. The storefront applies these, so prices turn burgundy and buttons lose their pill shape. The client's palette, in the contract's field names, is:
`gold: "#ffa3df"` (soft pink), `burgundy: "#ff35b9"` (hot pink), `darkBackground: "#000000"`, `darkSurface: "#0d0d0d"`, `lightBackground: "#fbf6f2"`, `lightSurface: "#f4ebe5"`, `radius: 999`, `theme.defaultMode: "dark"`.
Please reseed those, or the owner can save them in Admin → Branding.

The package's frontend files were older snapshots of the current code and were not copied in. Their requirements (empty homepage valid, no `.map` on unvalidated data, failures degrade, server logs keep the endpoint) are already met. nginx `client_max_body_size 8m` is confirmed live (a 5 MB body reaches Fastify).

## Security and robustness audit, 30 Oct 2026 (backend items)
Reviewed against `https://api.queenluxuryhair.store/v1` and the `server.ts` in the latest handoff package. Good: parameterised SQL everywhere (a `' OR 1=1--` search is handled safely), argon2id passwords, HttpOnly SameSite=Lax cookies, CORS limited to the storefront origins, Helmet-style headers, a global 120/min rate limit, no stack traces in errors, page size capped at 100.

| Severity | Finding | Fix |
|---|---|---|
| **High** | **No role/permission enforcement.** `requireSession` only checks that a staff member is signed in; no admin route checks permissions. Any future staff account (e.g. "Fulfilment") could edit prices, delete products, or manage staff and roles, including promoting itself. Only the owner exists today, so there is no exposure yet. **Fix before creating any other staff account.** | Add `requirePermission(req, reply, "<permission>")` per route using the map in `docs/BACKEND_INTEGRATION.md`; return 403 `forbidden`. |
| Medium | Login brute force: admin and customer login are covered only by the global 120/min/IP limit. | Per-route limit (e.g. 5/min per IP and per email) with a short lockout; same for register and password reset. |
| Medium | Session cookie `secure` depends on `NODE_ENV==='production'`. | Set `secure: true` unconditionally in production config, and confirm `NODE_ENV` on the VPS. |
| Low | Malformed JSON body returns 500. | Return 400 `invalid_json` (Fastify `onError`/content-type parser). |
| Low | `GET /products?page=abc` returns 500 (NaN reaches OFFSET). | Validate `page`/`pageSize` as integers; default or 400. |
| Low | `GET /media/not-a-uuid` returns 500. | Validate the id; 404. |
| Low | Unknown routes return 501; preflight from a disallowed origin returns 501. | 404 for unknown routes; 204 (no CORS headers) or 403 for disallowed preflights. |
| Low | `DELETE /admin/media/:id` checks `products.attributes` for use, not `product_media`. | Check `product_media` (and collection images) so used photos can't be deleted, leaving broken images. |
| Low | `DELETE /admin/products/:id` archives instead of deleting. | Delete, or confirm "archive" semantics and we'll relabel the button. |
| Info | Payment redirects: the frontend accepts any `https` `redirectUrl` from checkout. | When the provider is chosen, tell us its domains and we'll allow-list them. |
| Info | nginx error pages (413/414/502) have no CORS headers, so browsers show them as network errors. | `add_header Access-Control-Allow-Origin $cors_origin always;` for allowed origins. |

Frontend fixes from the same audit are deployed (see the git log for 30 Oct): security headers and CSP, link sanitising, theme-script hardening, demo credentials removed from live bundles, layout and accessibility fixes.

## Payments: Paystack only (30 Oct 2026)

The owner has decided the shop takes payment through **Paystack only**. The frontend now:

- offers only `paymentMethod: "paystack"` at checkout (anything else in `GET /store/payment-options` is ignored);
- only follows a payment `redirectUrl` that is `https://` on `paystack.com` or a subdomain (e.g. `checkout.paystack.com`); any other URL is refused and the shopper lands on their order page instead;
- in Admin → Delivery & payment, shows Paystack only, and on save sends `flutterwave.enabled`, `bankTransfer.enabled` and `payOnDelivery.enabled` as `false`;
- only ever handles the **public** key (`pk_test_…` / `pk_live_…`). It refuses anything starting with `sk_` and checks that the key matches the chosen mode.

Live state today: `GET /store/payment-options` returns `{"methods":[]}`, so checkout says online payment isn't switched on yet.

### What the backend needs to build (from the Paystack docs)

1. **Secret key in the server environment only.** For example `PAYSTACK_SECRET_KEY` (live `sk_live_…`, test `sk_test_…`). It must never be returned by any API or put in a `NEXT_PUBLIC_` variable. Every Paystack API call sends `Authorization: Bearer <secret key>`.
2. **`PUT /admin/settings/payments`** (still missing) must accept `{ paystack: { enabled, mode, publicKey }, … }` and persist it. `GET /store/payment-options` must then return `{ methods: [{ method: "paystack", label, description }] }` when Paystack is enabled and a secret key for that mode is configured.
3. **On `POST /checkout` with `paymentMethod: "paystack"`:**
   - create the order with `paymentStatus: "pending"`, priced by the server;
   - call `POST https://api.paystack.co/transaction/initialize` with:
     - `email`: the customer's email;
     - `amount`: the order total in **kobo**, an integer;
     - `currency: "NGN"`;
     - `reference`: unique per attempt, e.g. order number plus a suffix; store it on the order;
     - `callback_url`: `https://www.queenluxuryhair.store/order/<number>?token=<accessToken>`;
     - `metadata`: `{ orderId, orderNumber }`;
     - optionally `channels: ["card","bank","ussd","bank_transfer"]`.
   - return `payment: { provider: "paystack", status: "pending", reference, redirectUrl: data.authorization_url }`. The frontend redirects the shopper there.
4. **Never trust the browser return.** Paystack appends `?reference=…` when it sends the shopper back to `callback_url`, and that does **not** prove payment. Mark an order paid only after either:
   - `GET https://api.paystack.co/transaction/verify/:reference` confirms `data.status === "success"`, `data.amount` equals the order total in kobo, `data.currency === "NGN"`, and the reference belongs to this order; or
   - a verified webhook (next item).
5. **Webhook:** `POST /v1/payments/paystack/webhook`, or whichever path you choose.
   - Verify the `x-paystack-signature` header. It is an HMAC-SHA512 of the **raw request body**, keyed with the secret key. Compare in constant time. Optionally also allow-list Paystack's IPs: `52.31.139.75`, `52.49.173.169`, `52.214.14.220`.
   - Handle `charge.success`: re-verify the amount, currency and reference, then mark the order `paid`. This must be **idempotent**: the same event can arrive several times, so never double-fulfil.
   - Return `200` quickly and do slow work after. Paystack retries failed deliveries: in live mode every 3 minutes for the first 4 tries, then hourly for 72 hours.
   - The owner (or you) enters this URL in Paystack Dashboard → Settings → API Keys & Webhooks.
6. **Order page refresh:** after the redirect back, `GET /store/orders/:number?token=…` should show the real status. It's fine to call verify there if the webhook hasn't landed yet.
7. **Refunds** (later): `POST https://api.paystack.co/refund` with `{ transaction: reference, amount }`. This backs `POST /admin/orders/:id/refund`.
8. Make sure the server's CSP or allow-lists don't block `checkout.paystack.com`. The frontend uses a full-page redirect, not the inline popup, so no Paystack script is loaded on our site.

### What the owner has to provide

- A Paystack business account that has been activated for live payments. Paystack asks for business details and the settlement bank account.
- **Public key** (`pk_live_…`, and `pk_test_…` for testing): she pastes it in Admin → Delivery & payment.
- **Secret key** (`sk_live_…` / `sk_test_…`): given privately to Hermes for the server environment, never pasted into the site or chat.
- She confirms the webhook URL is saved in the Paystack dashboard.

Sources:
- [Paystack: Accept payments](https://docs-v2.paystack.com/docs/payments/accept-payments/)
- [Paystack: Verify payments](https://docs-v2.paystack.com/docs/payments/verify-payments/)
- [Paystack: Webhooks](https://docs-v2.paystack.com/docs/payments/webhooks/)

## Admin gaps seen while simplifying the admin (30 Oct 2026)
The frontend now adapts these production formats: reviews `{items}` → list, `{review}` and `{order}` unwrapped, order `items` → `lines`, dashboard low-stock snake_case. Still missing on the backend:

| Area | Now | Needed |
|---|---|---|
| Collection photos | `imageId`/`bannerId` ignored; collections come back with `image: null` | Persist them. The admin warns the owner when a photo isn't kept. |
| Order detail | No contact phone, delivery address, delivery method or timeline in `orderView` | Include `contact`, `shippingAddress`, `shippingRate`, `timeline` (contract `Order`). The admin shows "not recorded" until then. |
| Payment settings | `GET /admin/settings/payments` only | `PUT /admin/settings/payments` (Delivery & payment screen can't save) |
| Staff | No `POST /admin/staff` | Invite endpoint, **after** per-permission authorization is in place |
| Orders | No `transfer-received` or `refunds` routes | Implement when bank transfer and card payments go live |
| Products with sizes | One price/stock per product | Persist `variants[]` if the client sells sizes as one product |

---

## Priority 1: create and manage products

| # | Endpoint | Now | Dashboard screen | Contract |
|---|---|---|---|---|
| 1.1 | `GET /admin/product-types` | **501** | Product editor (type picker, attribute fields) and product list (type filter) | Returns `ProductType[]`: `{ id, name, description, optionNames: string[], attributes: AttributeDefinition[], productCount }`. An **empty array is a valid answer** for a new store. |
| 1.2 | `PUT /admin/product-types` | **501** | Product types screen (create and edit) | Body `ProductTypeInput` (`ProductType` minus `id?`/`productCount`); returns `ProductType`. |
| 1.3 | `DELETE /admin/product-types/:id` | **501** | Product types screen | `{ ok: true }`; 409 if products still use it. |
| 1.4 | `POST /admin/products` | 401 (unconfirmed) | Product editor, Save (new) | Body `ProductInput`; returns `Product`. Must persist `status` (`draft \| published \| archived`), `collectionIds`, `mediaIds`, variants (price in kobo, SKU, inventory), `productTypeId` (nullable) and attribute values. 422 with `fields`. |
| 1.5 | `PUT /admin/products/:id` | 401 (unconfirmed) | Product editor, Save, **Publish/Archive** (via `status`), collection membership | Same body; returns the saved `Product`; 404 for an unknown id. |
| 1.6 | `DELETE /admin/products/:id` | 401 (unconfirmed) | Product editor, Delete | `{ ok: true }`; 404 for an unknown id. |
| 1.7 | `POST /admin/products/:id/duplicate` | **501** | Product editor, Duplicate | Returns the new `Product` (as a draft). |
| 1.8 | `PATCH /admin/products/:productId/variants/:variantId` | **501** | Not used by the UI today | Optional. |

**Note:** the product editor does **not** need product types to save. With 1.1 at 501 it now shows "Product types couldn't be loaded (…). You can still save this product without a type." instead of silently showing no types.

## Priority 2: product images
| # | Endpoint | Now | Screen | Contract |
|---|---|---|---|---|
| 2.1 | `POST /admin/media` | 401 (unconfirmed) | Media library and the editor's image picker | Body today: `{ fileName, mimeType, sizeBytes, width, height, alt, tags, dataUrl }` (base64 data URL); returns `Media` `{ id, url, alt, width, height, mimeType, tags, createdAt }`. **`url` must be absolute https.** If you prefer signed direct uploads (better for large photos), propose `POST /admin/media/uploads` → `PUT` to storage → `POST /admin/media`, and we'll switch the frontend once agreed. |
| 2.2 | `GET /admin/media`, `PATCH /admin/media/:id` (alt, tags), `DELETE /admin/media/:id` | 401 (unconfirmed) | Media library | `Media[]`, `Media`, `{ ok: true }`. |
| 2.3 | Media response headers | `Cross-Origin-Resource-Policy: same-origin` on the API today | Every product image on the storefront | Serve media **without** CORP `same-origin` (or from a CDN), or images won't load on `queenluxuryhair.store`. |

## Priority 3: collections
| # | Endpoint | Now | Screen | Contract |
|---|---|---|---|---|
| 3.1 | `GET /admin/collections` | 401 (unconfirmed) | Collections screen, product editor (collection checkboxes), product list filter | `Collection[]`; an empty array is valid. |
| 3.2 | `POST /admin/collections` | 401 (unconfirmed) | Collections, Create | Body `CollectionInput` (`title, handle, summary, description, status, imageId, bannerId, …`); returns `Collection`. |
| 3.3 | `PATCH /admin/collections/:id` | 401 (unconfirmed) | Collections, Edit, publish | Partial `CollectionInput`; returns `Collection`. |
| 3.4 | `DELETE /admin/collections/:id` | 401 (unconfirmed) | Collections, Delete | `{ ok: true, unassignedProductIds: string[] }`. |
| 3.5 | `PUT /admin/collections/order` | 401 (unconfirmed) | Collections, drag to reorder | Body `{ ids: string[] }`; returns `Collection[]` in the new order. |
| — | Membership | via `PUT /admin/products/:id` `collectionIds` | Product editor | Storefront `GET /collections/:handle` must return the product once it's assigned and published. |

## Priority 4: orders (needed as soon as the first order arrives)
| Endpoint | Now | Screen |
|---|---|---|
| `GET /admin/orders/:id` | **501** | Order detail (opening any order) |
| `POST /admin/orders/:id/fulfillment` | **501** | Mark shipped or picked up, tracking number |
| `POST /admin/orders/:id/transfer-received` | **501** | Confirm a bank transfer |
| `POST /admin/orders/:id/cancel`, `/refunds`, `/notes` | **501** | Cancel, refund, internal notes |
| `POST /orders/:number/verify-payment` | **501** | Customer order confirmation page (re-checks the payment provider) |

Contract types: `Order`, `FulfillmentUpdate` and the related types in `src/lib/types/index.ts`; routes in `docs/API_CONTRACT.md`. Payment status must come only from the provider or webhook, never from the client.

## Priority 5: store settings the owner will need soon
| Endpoints (all **501**) | Screen |
|---|---|
| `GET/PUT /admin/settings/store` | Branding and store details (contact email, phone, WhatsApp, hours, socials, announcement) |
| `GET/PUT /admin/settings/shipping` | Shipping zones and rates |
| `GET/PUT /admin/settings/payments` | Payment methods shown at checkout (never secret keys) |
| `GET/PUT /admin/content/homepage`, `GET/PUT /admin/content/navigation`, `GET /admin/pages`, `PUT /admin/pages/:slug` | Homepage sections, menus, policy pages. The storefront already works without these: it shows static brand sections and fallback menus. |

## Priority 6: everything else that's 501
- **Customers:** `GET /admin/customers`, `GET /admin/customers/:id`.
- **Messages:** `GET /admin/inquiries`, `PATCH /admin/inquiries/:id`.
- **Discounts:** `GET/POST /admin/discounts`, `PUT/DELETE /admin/discounts/:id`, plus storefront `POST /carts/:id/discounts` and `DELETE /carts/:id/discounts/:code`.
- **Analytics:** `GET /admin/analytics`.
- **Admin search box:** `GET /admin/search?q=`.
- **Staff and roles:** `GET/POST /admin/staff`, `PATCH/DELETE /admin/staff/:id`, `GET/PUT /admin/roles`, `DELETE /admin/roles/:id`.
- **Customer password reset confirm:** `POST /customers/auth/password-reset/confirm`.
- **Reviews:** `GET /products/:id/reviews` returns 500 for an unknown id (should be 404). Full spec in `docs/REVIEWS_API.md`.

## Owner permissions (unchanged requirement)
The owner role must carry all 17 permissions (or `*`), and `GET /admin/auth/session` must return them:
`dashboard:read, products:read, products:write, collections:write, inventory:write, media:write, orders:read, orders:write, orders:refund, customers:read, content:write, discounts:write, reviews:moderate, inquiries:respond, analytics:read, settings:write, staff:manage`.
Every admin endpoint must enforce its permission (map in `docs/BACKEND_INTEGRATION.md`).

---

## Signed-in, read-only check (for the owner)
This confirms the 401 rows above without changing anything.
1. Sign in at `https://www.queenluxuryhair.store/admin`.
2. Open the browser console (F12 → Console) and paste the snippet below.

It sends **only GET requests** with your own session and prints each endpoint's status. For successful responses it shows the field names only, never the values.

```js
(async () => {
  const api = "https://api.queenluxuryhair.store/v1";
  const paths = ["/admin/dashboard", "/admin/products", "/admin/product-types", "/admin/collections", "/admin/media", "/admin/inventory", "/admin/orders", "/admin/reviews", "/admin/customers", "/admin/analytics", "/admin/discounts", "/admin/inquiries", "/admin/content/homepage", "/admin/content/navigation", "/admin/pages", "/admin/settings/store", "/admin/settings/shipping", "/admin/settings/payments", "/admin/staff", "/admin/roles", "/admin/search?q=a"];
  const rows = [];
  for (const p of paths) {
    const r = await fetch(api + p, { credentials: "include" });
    let result = "";
    try {
      const j = await r.json();
      result = j?.error?.code ?? (Array.isArray(j) ? `array(${j.length})` : Object.keys(j).slice(0, 10).join(", "));
    } catch { result = "not JSON"; }
    rows.push({ endpoint: "GET " + p, status: r.status, result });
  }
  console.table(rows);
})();
```

## Verification once each priority is deployed
Done in the real production dashboard with the owner signed in, using clearly named test records (prefix `TEST – delete me`), which are deleted afterwards. Real store data is never touched.
- **P1:** create a draft product → reload (it persists) → edit → publish (visible on the storefront) → archive (hidden) → delete (gone after reload).
- **P2:** upload an image → attach it to the test product → it shows on the storefront → delete it.
- **P3:** create a collection → assign the test product → reorder → it shows on `/collections/:handle` → delete it (products unassigned).
- **Cart:** with the published test product, add to bag → change quantity → remove → reload (state persists) → clean up.
