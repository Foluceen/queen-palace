# Ìrun — premium hair storefront and admin

Next.js (App Router) + React + TypeScript + Anime.js frontend for a Nigerian hair vendor: a storefront with guest checkout in naira, and a permission-aware admin. It runs fully on a built-in mock backend today and switches to the Fastify + PostgreSQL backend with one environment variable.

"Ìrun" (Yoruba for hair) is a placeholder brand. The name, colours, logo, contact details, homepage and menus are all editable in the admin.

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
| Demo owner | `owner@irun.test` / `demo-owner` |
| Demo store manager | `manager@irun.test` / `demo-manager` |
| Demo fulfilment | `fulfilment@irun.test` / `demo-fulfilment` |
| Demo customer | `customer@irun.test` / `demo-customer` |

The login screens offer the demo accounts as one-tap buttons in mock mode. Each role sees a different admin.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript rules) |
| `npm run verify` | Typecheck, lint and build in one go |
| `npm run smoke` | Hits every route, then runs a guest checkout and admin permission checks over HTTP. Run it against `npm start`; set `BASE_URL` for other ports. |
| `npm run media:placeholder` | Regenerates the placeholder hair artwork in `public/media` (Python 3 + Pillow + numpy) |

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

### Design system

- Palette (editable in admin → Branding): background `#0B0709`, panels `#161015`, primary pink `#FF4F9A`, highlight gold `#D8B25A`, soft blush `#F6B3CF`. Three presets are included.
- Type: Bricolage Grotesque (display) and Manrope (body), self-hosted variable fonts. The latin-ext subsets carry the ₦ sign and load only when needed.
- Tokens live in `src/app/globals.css`. Storefront styles are in `src/app/(store)/store.css`; the calmer admin styles are in `src/app/admin/admin.css`.

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

## Verification done

- `npm run typecheck`, `npm run lint` and `npm run build` pass. The build covers 31 routes; catalog pages are statically rendered or use ISR.
- `npm run smoke` passes all 75 checks:
  - every route, plus real 404s for missing pages
  - cart → discount → delivery quote → validation errors → bank-transfer order (stays "awaiting transfer")
  - idempotent retry, token-protected order access, and tracking
  - admin 401/403 checks per role, transfer confirmation before shipping
  - collection create, reorder and delete reflected on the storefront
- Browser checks run on a 390px mobile viewport:
  - add to bag from the PDP, drawer, full checkout form, confirmation page
  - every admin page as the owner
  - restricted views as fulfilment staff
  - reduced-motion rendering
  - no console errors

- Lighthouse 12, mobile preset (simulated slow 4G, 4× CPU), production build on a local server, warm image cache:

  | Page | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS |
  |---|---|---|---|---|---|---|---|
  | Home | 94 | 100 | 100 | 100 | 3.0 s | 70 ms | 0 |
  | Product | 94 | 100 | 100 | 91* | 3.0 s | 120 ms | 0 |

  On a cold image cache the first product-page hit scored 85, because images are optimised on first request. A CDN or Vercel caches them after that.

  \*The product description is placed in `<head>` for crawlers and link-preview bots (`htmlLimitedBots` in `next.config.ts`). Lighthouse's default user agent isn't on that list, so it reports the description as missing; Googlebot and WhatsApp receive it.

  LCP is the hero or gallery image. Real photography exported as 4:5 JPEG at around 1600px and 80% quality keeps it light. Re-run Lighthouse on your real deployment, since field Core Web Vitals depend on hosting and your actual photos.
