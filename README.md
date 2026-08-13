# Publish Coffee Roasters

E-commerce site and blog archive for Publish Coffee Roasters (PT Aroma Pulau
Arunika). Sells retail coffee in three sizes, takes custom-quote roasting
requests, and hosts an owned, themed blog archive.

Built against the v1 build spec. Two documents matter more than this one if you
run the shop rather than the code:

- **[docs/OPERATOR_SETUP.md](docs/OPERATOR_SETUP.md)** — one-time setup,
  click by click, written for a non-developer.
- **[docs/RUNNING_THE_SHOP.md](docs/RUNNING_THE_SHOP.md)** — the day-to-day
  admin guide.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database | Supabase / Postgres, with Row Level Security |
| Auth | Supabase Auth — email/password + Google |
| Storage | Supabase Storage (`media` bucket) |
| Payments | Xendit (default) or bank transfer + kode unik + Moota, behind one adapter |
| Shipping | Flat-rate zones from the database, behind a provider adapter |
| Hosting | Vercel |
| Styling | Tailwind CSS |

## Running locally

```bash
npm install
cp .env.example .env.local     # fill in the Supabase values
npm run dev
```

Paste `supabase/setup.sql` into the Supabase SQL editor and run it — that is
the whole database in one file. Then make yourself an admin (Step 4 of the
operator setup).

`setup.sql` is **generated** from `supabase/migrations/*.sql`. Add a numbered
migration, then run `npm run build:sql` to regenerate it, and commit both. An
existing deployment upgrades by running the new numbered file only.

```bash
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (Next 16 removed `next lint`)
npm audit           # should stay at 0 vulnerabilities
```

## How it fits together

```
src/
  app/
    (site)/          storefront: home, shop, blog, cart, checkout, account
    admin/           the operator dashboard
      _actions/      server actions; every one starts with an admin check
    api/
      checkout/      prices and creates orders (authoritative)
      webhooks/      xendit + moota payment callbacks
    rss.xml/, sitemap.ts, robots.ts
  components/        UI, split site / admin
  lib/
    payments/        provider adapter — see below
    shipping/        provider adapter; flat-rate zones today
    supabase/        browser / server / service-role clients
supabase/
  migrations/        schema, RLS, seed data — source of truth
  setup.sql          generated: all migrations in one paste-able file
```

### Three Supabase clients, on purpose

- `lib/supabase/client.ts` — browser, anon key, RLS applies.
- `lib/supabase/server.ts` — server components, carries the user's session,
  RLS applies. This is what user-facing reads go through.
- `lib/supabase/admin.ts` — **service role, bypasses RLS.** Only for payment
  webhooks, order creation, and admin mutations that have already checked the
  caller. Never import it into anything that renders in the browser.

### Payments

The spec left the payment path open, so it is an interface rather than a
choice baked into checkout. `lib/payments/types.ts` defines the contract;
`PAYMENT_PROVIDER` selects the implementation.

- **`xendit`** (default) — Invoice API. Dynamic QRIS, virtual accounts,
  e-wallets, and cards for international customers. Fully automatic.
- **`manual_transfer`** — adds a unique 3-digit code to each order total so
  Moota can reconcile incoming bank credits by exact amount. Domestic only.
  Anything that fails to match becomes a queue item in Admin → Payments rather
  than a lost order.

Adding a third provider means implementing `PaymentProvider` and adding a
webhook route. Nothing in checkout changes.

Every path settles through one Postgres function, `mark_order_paid`, which is
idempotent: a webhook delivered twice sets the status, decrements stock and
awards loyalty points exactly once. The admin's manual "mark as paid" calls the
same function, so a hand-settled order is indistinguishable from a real one.

### Images are shrunk before they reach Supabase

The free Supabase plan gives 1 GB of file storage and 5 GB of monthly egress,
and **does not include image transformations** — there is no server-side
resize to fall back on, so whatever is stored is what gets served.

Three things keep that allowance from draining:

1. **`lib/image-compression.ts`** re-encodes every upload in the browser first
   — downscale to a per-folder maximum, WebP where the browser can encode it,
   quality stepped down until the file fits a size target. A 29 MB PNG comes
   out at ~195 KB. Verified in Chromium across large photos, transparency,
   portrait aspect ratios, already-small images and SVG passthrough.
2. **`next.config.ts`** trims `deviceSizes`, `imageSizes` and `qualities`, and
   raises `minimumCacheTTL` to 31 days. Vercel's optimiser fetches the original
   from Supabase once per (url, width, quality) combination, so fewer allowed
   combinations means fewer origin fetches. Replacing a photo writes a new
   path, so a long TTL never serves a stale image.
3. **Migration 0004** adds `media_storage_usage()` and `unused_media()`,
   surfaced at Admin → Site settings → Images & storage. Replacing a photo
   leaves the old file in the bucket; that page finds them and clears them,
   excluding anything uploaded in the last 24 hours so in-progress edits are
   never deleted.

### One order model, two channels

Counter sales reuse `orders` rather than getting their own table, marked with
`channel` ('online' | 'pos'). A counter sale has no address, no shipping and no
pending state — it is settled the moment it is rung up.

`record_pos_sale()` does the whole thing in one transaction: locks every
variant and checks stock before writing anything, prices from the database
(never from the till screen), then settles through the same `mark_order_paid`
the payment webhooks use. A sale that fails any check writes nothing — no
phantom order, no half-decremented stock.

The payoff is that stock is genuinely shared: selling the last bag at the
counter makes it unavailable online in the same instant, because it is one
`product_variants.stock` column and one settlement path. `sales_summary()` and
`product_sales_report()` then read across both channels, with day boundaries in
WIB rather than UTC.

### Shipping is a provider adapter too

`lib/shipping/types.ts` defines `ShippingProvider`; `flat-zones.ts` is the only
implementation today, selected by `SHIPPING_PROVIDER`. Three decisions were
made for the live-rate case rather than the flat-rate one: quoting is async,
the browser never prices shipping (checkout calls `POST /api/shipping/quote`,
debounced), and weight and subtotal are recomputed server-side from variant ids
so a tampered cart cannot buy cheaper shipping. That last one is also why a
carrier API key can ever be used — it can only live server-side.

Zones support two discount tiers: free over a spend, and an optional fixed
amount off over a lower spend. The discount is capped at the shipping rate, so
it can reach free but never discounts the product. What was absorbed is stored
on the order rather than recomputed, so a later rate change cannot rewrite what
past orders cost. See docs/SHIPPING.md.

### Staying inside the free tier

Supabase's free plan allows 1 GB of file storage and 5 GB of monthly egress,
and **database egress counts against the same 5 GB as images** — which is the
part that is easy to miss.

Measured against a request-logging stand-in for Supabase, an anonymous
storefront page view originally cost **3-5 database round-trips, on every
view**, because `(site)/layout.tsx` read the session to decide whether the
header said "Sign in" or "Account". A layout that reads cookies opts every page
beneath it out of static rendering, so `export const revalidate` was doing
nothing at all. The same measurement after the fix: **21 page views, 0 database
calls.**

What keeps it there:

- **The site layout never reads cookies.** `AccountLink` works out sign-in
  state on the client from cookie presence — no network call — so the whole
  storefront renders statically. Getting it wrong is harmless: `/account`
  redirects anonymous visitors to `/login`.
- **`getSiteSettings` is wrapped in React `cache()`**, since the root layout's
  `generateMetadata` and the site layout both need it — two identical queries
  per render otherwise.
- **Revalidation windows are long** (30 min to 24 h). Every admin action calls
  `revalidatePath`, so edits appear immediately; the timer is only a backstop
  for changes made outside the admin and scheduled posts going live.
- **Images are shrunk before upload** and served from Vercel's optimiser cache,
  so Supabase serves each image roughly four times per cache cycle rather than
  once per visitor.
- **Uploads are refused past 95% of the storage allowance**, with a warning
  from 80%, pointing at the cleanup page. Reporting usage is not the same as
  preventing overrun.

Rough monthly budget at small-shop traffic: images tens of MB, revalidation
tens of MB (bounded by traffic, not by the timer — no request, no
revalidation), page views themselves nothing. Against 5 GB there is a lot of
headroom. The figure to watch is Supabase's own usage dashboard; the caveat is
that Vercel's cache is regional and can evict, so treat these as the right
order of magnitude rather than a guarantee.

The storefront ships ~188 KB of gzipped JavaScript, essentially all React and
the Next runtime. The Supabase client is **not** in the storefront bundle — it
only loads on the auth pages and in the admin.

### Money is never trusted from the client

`/api/checkout` ignores the prices in the submitted cart. It re-reads every
variant, re-checks stock and active flags, recomputes the subtotal, resolves
the shipping zone from the address, and prices the order from that. The cart
carries prices only so the UI can render without a round-trip.

### Row Level Security

Enabled on every table. Public traffic reads published storefront content
only; a signed-in user reads and writes only their own rows; admins get full
access through `is_admin()`, a `SECURITY DEFINER` function so the policies that
call it do not recurse. Orders and payment events have no client-side insert
policy at all — those writes only ever happen server-side.

## What the operator can and cannot change

Bounded presentation controls, per spec §7.2. Each maps to a database field the
templates already read:

- product order (drag or arrow), feature toggle, per-product accent colour
- hero image, headline, sub-heading and button
- announcement banner: on/off, text, link, background
- homepage category selection and order

Deliberately **not** in the admin: free-form layout editing, arbitrary new page
types, typography and spacing. Structural change is a code change. That is what
keeps the live dashboard safe for a non-developer to use.

## Decisions taken where the spec left them open

| Question | Decision |
|---|---|
| Payment path | Both built. Xendit is the default; the fallback is one env var away and needs no code change. |
| Domestic courier | Flat zones for launch. Shipping is behind a provider interface, so live rates are an added implementation rather than a rewrite. Provider pricing has moved since the spec was written; docs/SHIPPING.md has the current picture and, more usefully, the request-volume arithmetic that actually decides it. |
| International zones | Five flat zones seeded — SE Asia, Asia-Pacific, Europe, North America, rest of world — with padded rates, editable in the admin. |
| Loyalty rate | 1 point per Rp 10.000; Silver at 100, Gold at 500. All three are admin settings, not constants. |
| Bilingual copy | No i18n framework. Copy is English with Indonesian where it reads more naturally (*jasa roasting*, *kode unik*, province labels at checkout). |
| Rich text | Markdown with a toolbar and preview rather than a WYSIWYG — clean stored content, and the published typography stays ours. |

## Still open

- Brand assets: logo, typeface and product photography are placeholders. The
  palette is a coffee-brown scale in `tailwind.config.ts`.
- Transactional email. Orders confirm on-screen and the order page live-updates
  when payment clears, but no receipt is emailed yet. Needs an ESP.
- Newsletter capture stores addresses in `newsletter_subscribers`; nothing
  sends to them yet.
- Biteship live rates (spec's v2 shipping upgrade).
- `CartProvider` reads localStorage in an effect. `useSyncExternalStore` is the
  correct API for an external store and would also subsume the cross-tab
  listener; the Next 16 lint rules flag it. Suppressed with a note rather than
  rewritten inside a security upgrade — worth doing as its own change.
- The POS is online-only. It is a web app against Supabase, so it needs a
  working connection at the counter; there is no offline queue. Barcode
  scanning, cash-drawer hardware and thermal receipt printing are also not
  wired up — receipts are on-screen.
- Online orders reserve stock at payment, not at checkout. With a shop selling
  the same stock, a pending online order can be undercut at the counter. The
  counter refuses to oversell, but the online customer would then be refunded.
