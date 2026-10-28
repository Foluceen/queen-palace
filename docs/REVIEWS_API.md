# Customer reviews: API the frontend needs

Status: **frontend built and tested against the mock backend (29 Oct 2026). Not yet available on the live API.** On 28 Oct 2026 the live `GET /v1/products/:id/reviews` answered `500` and the admin review endpoints answered `501`.

Types live in `src/lib/types/index.ts` (`Review`, `ReviewInput`, `ReviewSubmission`, `ReviewSummary`, `ReviewPage`, `ReviewStatus`). Reference behaviour is in `src/lib/mock/backend.ts` and the `reviews` suite in `tests/mock-backend.test.ts`. The backend is authoritative for everything below. The frontend only checks fields before sending, for quick feedback.

## Statuses

| Status | Public? | Counted in the rating? | Who sees it |
|---|---|---|---|
| `pending` | No | No | Author (My reviews), staff |
| `approved` | Yes | Yes | Everyone |
| `rejected` | No | No | Author (with `rejectionReason`), staff |

This replaces the earlier `published | hidden` vocabulary. If the backend already stores `published` or `hidden`, map them to `approved` or `rejected` in responses. The frontend rejects any other status value as a `contract_mismatch`, because it can't explain an unknown state to a customer.

## Review object

```ts
interface Review {
  id: string;
  productId: string;
  productTitle: string;
  productHandle?: string;          // needed in My reviews to link back to the product
  author: string;                  // display name
  location: string | null;
  rating: number;                  // integer 1 to 5
  title: string;                   // may be ""
  body: string;
  verifiedPurchase: boolean;       // set by the backend only (a paid order with this product for this email/customer)
  status: "pending" | "approved" | "rejected";
  reply: string | null;            // public store reply
  rejectionReason: string | null;  // ALWAYS null in public lists
  createdAt: string;               // ISO 8601 UTC
  moderatedAt: string | null;
}
```

Never include the author's email, IP address or customer id in any response.

## Endpoints

### 1. List approved reviews (public)
`GET /products/:productId/reviews?page=1&sort=newest`

- `sort`: `newest` (default), `highest` or `lowest`. Ties break by newest. Unknown values fall back to `newest`.
- Returns approved reviews only, 6 per page (any page size works; the UI reads `pageSize`).
- Response `ReviewPage`:

```json
{
  "items": [Review],
  "page": 1, "pageSize": 6, "total": 14, "totalPages": 3,
  "summary": { "average": 4.6, "count": 14, "distribution": { "1": 0, "2": 0, "3": 1, "4": 3, "5": 10 } }
}
```

- `summary` is optional but recommended: it powers the rating breakdown. Without it the page uses `product.rating` and hides the bars. `summary.count` must equal `total`, and must match `product.rating.count`.
- `404 not_found` if the product doesn't exist or isn't published.

### 2. Submit a review (public; signed-in customers are linked)
`POST /products/:productId/reviews`

Body (`ReviewInput`):
```json
{ "author": "Adaeze O.", "email": "a@example.com", "location": "Ilesha", "rating": 5, "title": "Full to the ends", "body": "…" }
```

Validation the frontend applies, and the backend should enforce too:

| Field | Rule |
|---|---|
| `rating` | integer 1 to 5 |
| `author` | 2 to 60 characters after trimming |
| `email` | valid email; stored privately, never returned |
| `location` | optional, up to 60 characters |
| `title` | optional, up to 100 characters |
| `body` | 20 to 2000 characters after trimming |

Success: `201` with `ReviewSubmission`:
```json
{ "id": "rev_123", "status": "pending", "createdAt": "2026-10-29T09:00:00Z" }
```
- `status` is normally `pending`. Return `approved` only if the store auto-approves; the UI then says it's live and reloads the list. Return `rejected` (with optional `rejectionReason`) if an automatic filter refuses it.
- If the request carries a valid customer session cookie, link the review to that customer so it appears in My reviews. Guests may review unless the store decides otherwise (see `401` below).
- Set `verifiedPurchase` on the server from paid orders. Never accept it from the client.

Errors (standard `ApiErrorBody`), each shown to the shopper:

| Status | `code` | When | UI |
|---|---|---|---|
| 422 | `validation_failed` | Field errors, with `fields: { author, email, rating, title, body, location }` | Highlights the fields |
| 409 | `review_exists` | Same product already reviewed by this email or customer, while that review is pending or approved | "You've already reviewed this product" |
| 429 | `rate_limited` | Too many submissions from one IP or email | "Try again a little later" |
| 401 | `unauthenticated` | Only if the store requires an account to review | "Sign in to write a review" with a link |
| 404 | `not_found` | Unknown or unpublished product | Generic error |

The live API currently answers `400 validation_error` for bad input. The UI still shows the message and any `fields`, but `422 validation_failed` matches the rest of the contract.

Submissions are never retried automatically, and the form blocks double submits. Spam protection (rate limiting, link and phone filtering, a captcha if needed) belongs on the backend.

### 3. My reviews (customer)
`GET /customers/me/reviews` (session cookie required)

- Returns `Review[]`: every review linked to the signed-in customer, newest first, every status, **including** `rejectionReason`, and `productHandle`.
- `401` without a session.
- `501` or `404` hide the section behind "Your review history isn't available yet", so this can ship after the rest.

### 4. Moderation queue (admin, permission `reviews:moderate`)
`GET /admin/reviews?status=pending|approved|rejected` (no status means all)

Returns `Review[]` including `rejectionReason`. `401` without a session, `403` without the permission.

### 5. Moderate (admin, permission `reviews:moderate`)
`PATCH /admin/reviews/:id`

```json
{ "status": "approved" | "rejected" | "pending", "reply": "string or null (optional)", "rejectionReason": "string or null (optional, only meaningful when rejecting, max 300 chars)" }
```

- Returns the updated `Review`.
- Set `moderatedAt` when the status changes.
- Clear `rejectionReason` when the status is not `rejected`.
- Recalculate `product.rating` (average and count, approved only) in the same transaction.
- Optional: email the author when the status changes (approved, or rejected with the reason). The UI doesn't promise this, so it can come later.

## Other places that read reviews

- `GET /store/homepage`: a `reviews` section must contain approved reviews only, without `rejectionReason`.
- `product.rating` on cards and product pages must count approved reviews only. Product JSON-LD uses it for `AggregateRating`.

## Suggested table

`reviews(id, product_id, customer_id NULL, email, author, location, rating, title, body, status, reply, rejection_reason, verified_purchase, created_at, moderated_at, moderated_by NULL)`, with:
- an index on `(product_id, status, created_at)`;
- a partial unique index on `(product_id, lower(email))` where `status <> 'rejected'`, which enforces the `409`.
