# Backend handoff

## Hermes backend implementation update

Production target: `https://api.queenluxuryhair.store/v1` on `162.35.31.120`, service `queen-palace-api`, localhost bind `127.0.0.1:4000`, PostgreSQL database `queen_palace`.

Implemented and deployed:
- Admin session authorization with explicit role permissions. Owner has the 17 documented permissions; unknown/restricted staff roles receive only rows from `role_permissions`. Protected admin routes return `401 unauthorized` when unauthenticated and `403 forbidden` when the role lacks the required permission.
- Credentialed CORS for `https://www.queenluxuryhair.store` and `https://queenluxuryhair.store`; unapproved origins receive no allow-origin header.
- Product relation persistence: product variants, product-media ordering, product type relation, collection relation, ratings summary, and absolute HTTPS media URLs.
- Product type endpoints: `GET/PUT/DELETE /admin/product-types`.
- Product duplicate endpoint: `POST /admin/products/:id/duplicate`, creating a unique draft with `-COPY` SKU and zero stock.
- Variant update endpoint: `PATCH /admin/products/:productId/variants/:variantId`.
- Admin product filtering/pagination by query, status, collection (`none` supported), product type, page and pageSize. Storefront product pagination/filtering by query, price, stock and sort.
- Public media delivery at `GET /media/:id` with content type, immutable caching and `Cross-Origin-Resource-Policy: cross-origin`.
- Admin order detail, fulfillment, cancellation/restock and notes routes; cancellation and restock are transactional. Empty checkout now rolls back before returning `400`.

Database migrations added: `006_roles_permissions`, `007_product_relations`, `008_order_fields`.

Verified with a temporary owner session and disposable `TEST – delete me` records:
- Owner session returned 17 permissions and role permissions matched.
- Product type create/read worked.
- Product create/read persisted draft, price, variant and stock.
- Duplicate created a draft with zero stock.
- Test records were removed; production catalogue remains empty.
- `npm test`: 2 tests passed.
- Public live/ready checks: HTTP 200.

Deferred, not falsely marked complete:
- Payment-provider initialization/webhooks/refunds and email/SMS delivery require provider credentials/configuration.
- Settings/content, discounts, customer admin, staff/role CRUD, analytics, search and remaining secondary contract routes still need implementation.
- Frontend deployment remains owned by Claude; no frontend source was modified here.
