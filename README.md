# Queen Luxury Hair — storefront and admin

Next.js (App Router) + React + TypeScript + Anime.js frontend for **Queen Luxury Hair**, a hair and beauty store at Ijoka, beside Ibiyemi Building Material, Ilesha, Osun State, Nigeria. Prices are in naira (₦).

It has a storefront with guest checkout and optional accounts, and a permission-aware admin. Light and dark themes are included. It runs fully on a built-in mock backend today and switches to the Hermes Fastify + PostgreSQL backend with one environment variable.

**Only facts supplied by the owner are used.** The store name and address are real. Phone, WhatsApp, email, opening hours and social links are left empty and stay hidden until they're entered in admin → Branding and store. Policy pages are starter drafts marked "Needs review". Testimonials, reviews, orders and customers are labelled sample data in mock mode.

## Data mode

- **Production builds are live.** `.env.production` sets `NEXT_PUBLIC_DATA_MODE=live` and `NEXT_PUBLIC_API_BASE_URL=https://api.queenpalacebeauty.store/v1`. A live build talks only to the real API, and when the API is down or incompatible it shows a clear unavailable state. There is no fallback to demo data.
- **Local development is mock** by default (`npm run dev`), with the labelled demo store. Use `npm run build:mock` / `npm run start:mock` for a production-like demo build.
- `docs/LIVE_READINESS.md` has the current backend status, the API compatibility matrix and the launch checklist. `npm run probe:live` re-checks the real API (read-only).

## Quick start

```bash
npm install          # also copies self-hosted fonts into src/app/fonts
cp .env.example .env.local
npm run dev          # http://localhost:3000
```

| | |
|---|---|
| Store | http://localhost:3000 |
| Admin | http://localhost:3000/admin |
| Demo owner | `owner@queenluxuryhair.test` / `demo-owner` |
| Demo store manager | `manager@queenluxuryhair.test` / `demo-manager` |
| Demo fulfilment | `fulfilment@queenluxuryhair.test` / `demo-fulfilment` |
| Demo customer | `customer@queenluxuryhair.test` / `demo-customer` |

In mock mode, the login screens offer the demo accounts as one-tap buttons. Each role sees a different admin.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript rules) |
| `npm test` | Unit tests for the business rules in the mock backend: cart maths, discounts, Ilesha and state shipping quotes, stock, idempotent orders, product types, duplicate, collection delete keeping products, permissions, accounts, Nigerian phone validation |
| `npm run verify` | Typecheck, lint, unit tests and build |
| `npm run e2e` | Browser checks against a fresh mock server on port 3100 (`npm run build:mock && npx next start -p 3100` with `NEXT_PUBLIC_DATA_MODE=mock`): themes, mobile checkout in Ilesha, accounts, admin product creation, collection delete, permissions, reduced motion |
| `npm run docs:api` | Regenerates `docs/API_CONTRACT.md` from `src/lib/api/contract.ts` |
| `npm run brand` | Regenerates the logo set in `public/brand` and the app icons (needs Playwright) |
| `npm run smoke` | Hits every route, then runs a guest checkout and admin permission checks over HTTP. Run it against a mock build (`npm run build:mock && npm run start:mock`); set `BASE_URL` for other ports. |
| `npm run build:mock` / `npm run start:mock` | Production build and server on demo data |
| `npm run probe:live` | Read-only check of the real API: CORS, every public GET's shape, and 401s on authenticated GETs |
| `npm run media:placeholder` | Regenerates the placeholder hair artwork in `public/media` (Python 3 + Pillow + numpy) |
| `npm run preview:build` | Builds `dist-preview/`, a static single-page preview of the store and admin running the mock backend in the browser |

## Environment

See `.env.example`.

- `NEXT_PUBLIC_DATA_MODE` is `mock` (default) or `live`.
- `API_BASE_URL` and `NEXT_PUBLIC_API_BASE_URL` point at the Fastify backend, server-side and browser-side.
- `NEXT_PUBLIC_SITE_URL` is used for metadata and payment return URLs.
- `NEXT_PUBLIC_MEDIA_HOSTS` holds comma-separated image CDN hosts for `next/image`.
- `CATALOG_REVALIDATE_SECONDS` sets the catalog page cache lifetime.

Mock mode is clearly labelled on every page. Orders placed in mock mode are recorded with payment **pending**, because no provider is connected; nothing is charged and no email is sent.

## How it's built

```
src/
  app/
    (store)/            storefront routes (home, collections, products, search, cart,
                        checkout, order, track, account, wishlist, contact, content pages)
    admin/              admin login + (panel)/ routes guarded by session and permissions
    api/mock/[...path]  HTTP surface of the mock backend (disabled in live mode)
  components/
    store/  admin/  ui/  motion/
  lib/
    types/              shared domain types (copy these into the backend)
    api/contract.ts     every endpoint: method, path, request and response types
    api/client.ts       the single typed HTTP client
    data/storefront.ts  repository used by server components (mock or live)
    mock/               seed data, in-memory db, mock backend, router
    motion/anime.ts     lazy Anime.js wrapper and motion tiers
docs/
  API_CONTRACT.md         generated endpoint reference
  BACKEND_INTEGRATION.md  what the backend must implement and enforce
```

### Data flow

- **Server components** read through `storefront()` in `src/lib/data/storefront.ts`. In mock mode that calls the mock backend in-process; in live mode it uses the typed client with Next.js fetch caching.
- **Client components** (cart, checkout, admin) use `api()` from `src/lib/api/browser.ts`. In mock mode it targets `/api/mock`, which serves the same contract over HTTP. Mock and live therefore exercise identical client code.
- **No prices are computed in the frontend.** Cart totals, discounts, delivery quotes (with totals per option) and order totals all come from the backend. Money is integer kobo, formatted with `formatNaira`.
- **Admin permissions** hide or disable controls in the UI (`useAdmin().can()`, `<Can>`, `<RequirePermission>`); the backend enforces them on every call.

### Brand and design system

- **Direction.** A Shopify-style luxury hair store, based on a study of the client's reference (Hairs by Dinma) and the "Elixer" Shopify theme export. It uses:
  - a centred-logo header with an uppercase menu row and a scrolling ticker
  - a full-bleed photo hero with circular product insets and a blush pill button
  - circular category portraits with a cocoa glow and script labels
  - "BEST SELLER"-style carousels and square product cards with real star ratings
  - a features strip, collapsible product tabs and an espresso footer

  The theme's fabricated social proof (hard-coded review counts, invented comments) was deliberately not carried over: ratings come only from published reviews.
- **Logo.** A small crown over "QUEEN" in spaced Cormorant capitals, with "Luxury Hair" in Great Vibes script. The crowned-Q monogram is used for icons. Files in `public/brand/` (light and dark lockups, monograms, app icons, social avatar, OG image) are generated by `scripts/build-brand.mjs` from the actual fonts. `<Logo>` renders the vector inline and takes its colours from theme tokens. The owner can upload replacement logos in admin.
- **Palette.** Light mode: cream `#F8F1EA`, espresso text and buttons `#1F1612` / `#24170F`, cocoa `#5B3220`, blush pill `#F2C9DA`, gold stars and crown `#B88A4A`. Dark mode: near-black `#120D0B`, cocoa-charcoal surfaces, cream text, blush buttons. All colours are tokens in `src/app/globals.css`; the six brand colours can be changed in admin.
- **Type.** Cormorant Garamond (display), Great Vibes (script, wordmark and category labels only) and Manrope (body; its latin-ext subset carries the ₦ sign). All are self-hosted.
- **Shapes.** Pill buttons, square product imagery (as on Shopify), circular category portraits, and restrained shadows.
- **Photography.** The client's look relies on real model photos. The images in `public/media` are generated placeholders in the brand palette. Upload real photos (portrait 4:5 for products, square for collections) in admin → Media library.
- **Theme.** Light, dark or "match device", set from the header menu (storefront and admin). It's saved in `localStorage` (`qp-theme`) and applied by an inline script before first paint, so there's no flash and no hydration mismatch. The owner chooses the default for new visitors. Switching uses the View Transitions API where available. Styles are `src/app/(store)/store.css` and `src/app/admin/admin.css`.

### Motion

All motion goes through `src/lib/motion/anime.ts`, which lazy-loads Anime.js v4 after first paint.

- A tiny inline script sets `<html data-motion="none | essential | full">` before paint. It reads reduced-motion, Save-Data, 2G, and low memory or CPU.
- `none` shows everything still. `essential` keeps feedback (cart drawer, add to bag, variant changes) but skips decorative entrances. `full` adds the hero timeline, reveals, count-ups and depth.
- The hero uses one choreographed timeline: word-split headline, fade-in copy and spring price tags, plus scroll and pointer depth. A CSS fallback reveals everything at 2.4s if the script never runs.
- Scroll reveals fire once, only for content below the fold, so they never delay LCP.
- Every animation is interruptible. Toggling the bag mid-animation reverses it, and the drawer closes instantly on navigation.
- Only `transform` and `opacity` are animated. The marquee pauses off-screen, and nothing loops forever.

### Product photography

The images in `public/media` are generated placeholder art (hair textures and product shapes), not photos. Upload real photography in admin → Media library, assign it to products and collections, and delete the placeholders. Portrait 4:5 images of at least 1200px wide work best.

## What's in it

**Storefront.** Homepage sections, all editable and reorderable from the admin:
- hero with live stats
- marquee, collections
- promotion with a discount code
- featured, best sellers and new arrivals
- brand story, quality and trust
- shade guide
- testimonials, reviews
- hair-care tips, FAQ preview
- newsletter, WhatsApp call to action

Collection pages have a banner, search within the collection, sort, data-driven filters, pagination, stock labels and empty states.

Product pages have:
- a gallery with an optional video
- variants driven by each product's own options, with SKU, price and stock per variant
- quantity, Add to bag, Buy now
- WhatsApp inquiry, shown only when a number is set
- details grouped by product type (details, care, how to use)
- delivery and returns notes, reviews, related products and recently viewed

Also included:
- search with suggestions
- cart drawer and cart page
- guest checkout with Nigerian phone validation, state and town, and saved addresses for signed-in customers
- order confirmation and token-protected tracking
- accounts: register, sign in, password reset, addresses, order history, wishlist
- About, Contact (with a directions link), Hair care, FAQ, Shipping, Returns, Privacy and Terms pages

**Admin.** Covers:
- dashboard and analytics
- orders, customers, messages, discounts and reviews
- products: create, edit, duplicate, publish, archive, delete, video, product type and fields, multiple collections, SEO
- inventory, collections (banner, ordering, SEO, safe delete), product types, media
- homepage editor, navigation, pages (with "Needs review")
- branding and store details, shipping zones (state and town), payments, staff and roles

Throughout the admin there are global search (press `/`), confirmation dialogs, toasts, and loading, empty and error states.

**Never in the frontend:** authoritative prices, stock checks, payment verification or access control. In mock mode, card and pay-on-delivery orders stay **pending**, and bank transfer stays disabled until real account details are entered.

## Verification done (27 Oct 2026, mock mode, production build)

- `npm run typecheck`, `npm run lint` (0 warnings), `npm test` (20 tests) and `npm run build` (43 routes) all pass.
- `npm run smoke` passes all 77 checks: all routes, real 404s, cart, discounts, Ilesha and Lagos quotes, validation, a bank-transfer order that stays "awaiting transfer", idempotency, token access, tracking, per-role 401 and 403, and collection create, reorder and delete.
- Browser e2e (`scripts/e2e.cjs`) passes all 29 checks. It covers:
  - the theme toggle, persistence and no flash
  - a mobile, dark-mode Buy now flow through to a Pay on delivery order in Ilesha
  - phone validation
  - registration with a saved address that prefills checkout
  - creating a hair-care product with its own fields in the admin, then duplicating it
  - deleting a collection while keeping its products
  - analytics labelled as demo data
  - global search, fulfilment-role navigation and reduced motion

  No hydration or console errors. The only failed request is the deliberate 422 from the invalid-phone check.
- Every storefront route and every admin route was screenshotted in light and dark at 1440px, with key pages also at 390px. None scrolls horizontally.
- Lighthouse 12 mobile preset on the local production server. The 2-vCPU sandbox runs the server and Chrome together, so performance varies run to run:

  | Page | Performance | Accessibility | Best practices | SEO | CLS |
  |---|---|---|---|---|---|
  | Home | 82–88 | 100 | 100 | 100 | 0 |
  | Collection | 88–89 | 100 | 100 | 91* | 0 |
  | Product | 72–81 | 100 | 100 | 91* | 0 |

  \*Descriptions are served in `<head>` to crawlers and link-preview bots (`htmlLimitedBots`). Lighthouse's own user agent isn't on that list. Re-measure on the real host with real photography.

## Needs the real backend before launch

These are **not** connected or tested yet: PostgreSQL persistence, staff and customer authentication, Paystack and Flutterwave payments and webhooks, refunds, email (receipts, password reset, replies), file and video storage, and analytics in SQL. `docs/BACKEND_INTEGRATION.md` lists what each needs and the rules the backend must enforce. The owner still needs to enter contact details, review the policy pages, upload real photography and replace the sample testimonials.
