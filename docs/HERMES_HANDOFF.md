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
