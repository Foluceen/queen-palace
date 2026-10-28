# Backend integration (for the Fastify + PostgreSQL backend)

The frontend is complete against `src/lib/api/contract.ts`. In mock mode, `src/lib/mock/backend.ts` implements every endpoint in memory, and it is the reference for the behaviour described here. Switch to the real backend with `NEXT_PUBLIC_DATA_MODE=live`.

## What is not connected yet

Everything below works in mock mode, but only as a stand-in. Each item needs a real backend implementation before launch.

| Area | Current state in mock mode | What the backend must do |
|---|---|---|
| Persistence | In-memory, per server process; resets on restart. | PostgreSQL for every resource. Seed the five collections (Futura Wig, Bone Straight, Factory Wigs, Braids Extensions, Hair Maintains) as **rows**, not code. |
| Card payments (Paystack / Flutterwave) | `placeOrder` returns `redirectUrl: null`; payment stays `pending`. | Initialise a transaction and return its hosted `redirectUrl` with `callback_url = {SITE_URL}/order/{number}?token={accessToken}`. Handle provider **webhooks** (signature-verified) to set `paid` / `failed`. `verifyPayment` must re-query the provider. Never trust the redirect alone. |
| Bank transfer | Instructions come from settings; staff confirm manually. | Same flow, plus expire unpaid holds after `holdHours` and release reserved stock. Optional: virtual accounts (e.g. Paystack dedicated NUBAN) for automatic confirmation. |
| Refunds | `adminRefundOrder` returns 501 deliberately. | Call the provider's refund API; update status only after the provider confirms. |
| Emails and SMS | Not sent. UI says so in mock mode. | Order confirmation, transfer instructions, shipping updates (when `notifyCustomer`), review and inquiry replies, staff invites, newsletter. |
| Media uploads | Image is sent as a data URL in JSON (≤4 MB). | Prefer signed direct uploads to object storage (S3/R2/Cloudinary), then `POST /admin/media`. Return CDN URLs and add the host to `NEXT_PUBLIC_MEDIA_HOSTS`. Generate a `blurDataUrl` if you can. |
| Auth | Plain-text demo passwords; in-memory sessions. | Argon2id hashes, httpOnly Secure cookies, session expiry, login rate limiting, password reset, staff invite acceptance flow. |
| Customer accounts | One seeded demo customer. | Registration, login, password reset, order history by customer id (link guest orders by verified email). |
| Inventory | Decremented at order placement; restocked on cancel. | Do it inside a transaction with row locks (`SELECT … FOR UPDATE`), and write an audit row for every adjustment (`reason`, staff id, delta). |
| Cache revalidation | Store pages revalidate every 60s (`CATALOG_REVALIDATE_SECONDS`). | Optional: add a signed webhook that calls a Next.js `revalidateTag("catalog")` route after admin edits, for instant updates. |
| Analytics | Dashboard sums paid orders in memory. | Compute `/admin/dashboard` with SQL in the store's time zone (Africa/Lagos). |

## Rules the backend must enforce

- **Prices and totals.** Compute cart and order totals server-side from current variant prices. The frontend only displays what you return. Reject a checkout if the cart changed since it was quoted, returning `409 cart_changed` with a plain message; the UI refreshes the cart.
- **Idempotency.** `POST /checkout` carries `idempotencyKey`. The same key must return the same order and never create a second one.
- **Stock.** `deny` policy variants can never go below zero. `maxQuantity` on cart lines tells the UI the cap.
- **Discounts.** Validate status, dates, usage limits, minimum subtotal and eligible products/collections on every cart read.
- **Shipping.** `POST /checkout/shipping-rates` returns `ShippingQuote[]`, each with the full `totals` if chosen. The checkout shows those totals verbatim.
- **Guest order access.** `GET /orders/:number?token=` must require the opaque `accessToken`. Tracking needs number **and** email.
- **Admin authorisation.** Check the permission on every admin endpoint (table below). Return `401` when not signed in, `403` when the role lacks the permission. Staff can't change their own role or suspend themselves, and the Owner role can't be edited.
- **Public payment settings.** Never return secret keys. `GET /admin/settings/payments` returns public keys only; secrets live in the backend environment.

## Admin permissions per endpoint

| Permission | Endpoints |
|---|---|
| `dashboard:read` | `GET /admin/dashboard` |
| `products:read` | `GET /admin/products`, `GET /admin/products/:id`, `GET /admin/inventory`, `GET /admin/collections`, `GET /admin/media` |
| `products:write` | `POST/PUT/DELETE /admin/products…`, `PATCH /admin/products/:productId/variants/:variantId` |
| `inventory:write` | `POST /admin/inventory/adjustments` |
| `collections:write` | `POST/PATCH/DELETE /admin/collections…`, `PUT /admin/collections/order` |
| `media:write` | `POST/PATCH/DELETE /admin/media…` |
| `orders:read` | `GET /admin/orders`, `GET /admin/orders/:id`, `POST /admin/orders/:id/notes` |
| `orders:write` | `POST /admin/orders/:id/fulfillment`, `…/transfer-received`, `…/cancel` |
| `orders:refund` | `POST /admin/orders/:id/refunds` |
| `content:write` | `GET/PUT /admin/content/homepage`, `PUT /admin/content/navigation` |
| `discounts:write` | `/admin/discounts…` |
| `reviews:moderate` | `GET /admin/reviews`, `PATCH /admin/reviews/:id` |
| `inquiries:respond` | `GET /admin/inquiries`, `PATCH /admin/inquiries/:id` |
| `settings:write` | `/admin/settings/shipping`, `/admin/settings/payments`, `/admin/settings/store` |
| `staff:manage` | `/admin/staff…`, `PUT /admin/roles`, `DELETE /admin/roles/:id` (any signed-in staff may `GET /admin/roles`) |

## Suggested tables

`collections`, `products`, `product_collections` (with position), `product_options`, `variants`, `inventory_levels`, `inventory_adjustments`, `media`, `product_media` (with position), `carts`, `cart_lines`, `cart_discounts`, `orders`, `order_lines`, `order_events`, `payments` (provider, reference, status, raw webhook), `discounts`, `discount_redemptions`, `reviews`, `inquiries`, `inquiry_replies`, `shipping_zones`, `shipping_rates`, `settings` (JSON per key), `homepage_sections` (JSON with position), `navigation` (JSON), `content_pages`, `staff`, `roles`, `role_permissions`, `sessions`, `customers`, `wishlists`, `newsletter_subscribers`, `idempotency_keys`.

## Testing against the live backend

1. Set `NEXT_PUBLIC_DATA_MODE=live`, `API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`.
2. `npm run build && npm start`. The build pre-renders the homepage, so the backend must be reachable at build time.
3. Point `scripts/smoke-routes.mjs` at your API by changing `API` (it assumes the mock base path), or reuse its flow as an integration test in the backend repo.
