# Backend handoff for Hermes: launch blockers, 29 Oct 2026

The frontend owns nothing here except the contract it sends and reads. Every request and response type is in `docs/API_CONTRACT.md` and `src/lib/types/index.ts`. Reference behaviour (validation, status codes, permissions) is executable in `src/lib/mock/backend.ts` and `tests/mock-backend.test.ts`. Where production already returns an equivalent format, the frontend adapts it (`src/lib/api/normalize.ts`), so **the formats marked "accepted" below need no backend change**.

Checked against `https://api.queenluxuryhair.store/v1` on 29 Oct 2026, ~06:30 UTC, without credentials.

## Fixed since the last check
- CORS preflight now allows `GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS` with credentials for the production origin. ✅
- `POST /carts` returns 201 and `GET /carts/:id` returns 200 for a real cart. ✅

## 0. Owner permissions (29 Oct 2026, ~09:30 UTC)
The owner can sign in, but the admin showed "You don't have access to this section… dashboard:read".

Frontend (fixed in this deploy):
- The session adapter used only the *first* permission list it found, so a top-level `permissions: []` hid the list on `role.permissions`. All lists are now merged.
- Names that weren't spelled exactly like the frontend's (e.g. `dashboard.read`, `DASHBOARD_READ`) were silently dropped. They are now canonicalised. Explicit wildcards are honoured: `*` / `all` grant everything, and `products:*` grants every `products:` permission.
- An explicitly empty list stays empty. The frontend never grants permissions the backend didn't send. The access screen now shows the role and the exact permission names received.

Backend/database (Hermes):
- The seeded owner's role must carry every permission:
  `dashboard:read, products:read, products:write, collections:write, inventory:write, media:write, orders:read, orders:write, orders:refund, customers:read, content:write, discounts:write, reviews:moderate, inquiries:respond, analytics:read, settings:write, staff:manage`
  (or a single `*` grant, if your RBAC models the owner that way).
- `GET /admin/auth/session` must return them in `permissions` (top level or on `role.permissions`).
- If the owner still sees the access screen, its last line says "Permissions received from the store: …". If that says "none", the owner role's permission rows are missing in the database, or the session doesn't include them.
- The backend must enforce the same permissions on every admin endpoint. The UI only hides sections.

## 1. Admin sign-in (`POST /admin/auth/login`, `GET /admin/auth/session`, `POST /admin/auth/logout`)
Request (unchanged, verified in the browser): JSON `{ "email": "<trimmed, lower-case>", "password": "..." }`, `credentials: include`.

- **Success:** any 2xx. The response **must set the session cookie**: `HttpOnly; Secure; SameSite=Lax; Path=/`, with `Domain` unset or `.queenluxuryhair.store`. The frontend then calls `GET /admin/auth/session` and only enters the admin if that returns 200.
- **Session body:** the contract shape is `{ staff: { id, name, email, roleId, status, lastActiveAt }, role: { id, name, description, permissions, system }, permissions: string[], expiresAt }`.
  - **Accepted, no change needed:** `{ user | admin | staff: { id, email, name | firstName + lastName, role? }, role?: string | { id, name, permissions }, permissions?: string[] }`, optionally wrapped in `{ session }` or `{ data }`.
  - Permissions must come from the backend. Only when none are given **and** the role is `owner` does the UI show every section; the backend must still authorise each call.
  - Permission names: `PERMISSIONS` in `src/lib/types/index.ts`.
- **Failure:** `401 { "error": { "code": "invalid_credentials", "message": "..." } }`. This already works.
- **What the login screen now reports:**
  - "unexpected format" can no longer come from a successful sign-in.
  - If the cookie is missing, it says so: "accepted your password, but this browser didn't receive a session".
  - If the session body is unreadable, the browser console logs its **field names only** (no values) after `[admin] signed in, but the session response can't be read:`. Please compare those field names with the shape above, or send us a sanitised sample.
- **Owner credentials:** if the owner still gets `invalid_credentials`, check how the seeded email is stored (the frontend sends it lower-case and trimmed) and the password hash and algorithm. We have not tried any real credentials.

## 2. Carts
The frontend adapts the production format (`{ id, lines, subtotal, discountTotal, shippingTotal, total, currency }`). Still needed:

| Endpoint | Now | Needed |
|---|---|---|
| `GET /carts/:id` (unknown id) | 500 | **404** `not_found`. With a 404 the frontend drops the stale id and starts a fresh bag; a 500 leaves the shopper stuck. |
| `PATCH /carts/:id/lines/:lineId` (unknown) | 500 | 404 |
| `DELETE /carts/:id/lines/:lineId` (unknown) | 500 | 404 |
| `POST /carts/:id/lines` | 400 `Invalid cart lines` | Body is `{ "lines": [{ "variantId", "quantity" }] }`. Return `Cart`; 404 for an unknown cart or variant; 409 `insufficient_stock` with a message when quantity exceeds stock. |

Each cart line must carry: `id, productId, variantId, handle, productTitle, variantTitle, image (Media or null), quantity, unitPrice, compareAtPrice, lineTotal` (kobo integers), `maxQuantity` (most the backend will accept now) and `availability` (`in_stock | low_stock | out_of_stock | preorder`). Totals must be computed on the server.

## 3. Products (admin)
| Endpoint | Now | Needed |
|---|---|---|
| `PUT /admin/products/:id` | **501** | Implement. Body is `ProductInput`. It handles editing, **publishing and archiving** (`status: "draft" \| "published" \| "archived"`) and **collection membership** (`collectionIds`). Return the saved `Product`. 422 with `fields` for validation, 404 for an unknown id. |
| `DELETE /admin/products/:id` | **500 even without a session** | **Check auth before the handler (401 without a session)**, then 404 for an unknown id, then `{ "ok": true }`. A 500 for an unauthenticated request suggests the route runs or crashes before authentication: please check. |
| `PUT` without a session | 501 | Should be 401. Auth before the "not implemented" stub. |

## 4. Collections and media (admin)
All 501 today. Contract:
- `POST /admin/collections` (`CollectionInput`) and `PATCH /admin/collections/:id` (partial) return `Collection`.
- `DELETE /admin/collections/:id` returns `{ ok: true, unassignedProductIds }`.
- `PUT /admin/collections/order` with `{ ids }` returns `Collection[]` in the new order.
- Membership is set from the product side through `collectionIds` (section 3).
- `GET /admin/media`, `POST /admin/media`, `DELETE /admin/media/:id`.
  - The upload body today is `{ fileName, mimeType, sizeBytes, width, height, alt, tags, dataUrl }`. If you prefer signed direct uploads (recommended for production), propose the endpoints and we'll switch the frontend to match. Agree the format first.
  - `Media.url` must be an absolute https URL. Media must not be served with `Cross-Origin-Resource-Policy: same-origin` (the API sends that header today), or images won't load on the storefront.

## 5. Error format (all endpoints)
`{ "error": { "code", "message", "fields"? } }`, with the status codes the UI relies on: 400/422 validation (with `fields`), 401 not signed in, 403 no permission, 404 not found, 409 conflict, 429 rate limited, 5xx only for real server faults. The frontend also reads Fastify's default `{ statusCode, error, message }`, but please keep the envelope.

## Verification once deployed
Tell us when sections 1–4 are live. We'll run the browser checks:
- owner sign-in (entered by the owner), session persistence and logout;
- product create, edit, publish, archive and delete;
- collection create, edit, order and assignment;
- cart create, quantity change, remove and persistence.

We'll use clearly named test records and delete them afterwards. Real store data won't be touched.
