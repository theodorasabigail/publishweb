# Shipping

Two things live here: how the discounts you can set today work, and what it
takes to connect a real courier API later.

---

## Part 1 — discounts you can set now

**Admin → Site settings → Shipping rates.** Each zone has two optional
discount steps, and you can use either, both, or neither.

| Field | What it does |
|---|---|
| **Free shipping over** | Above this spend, shipping is free. |
| **Discount applies over** | Above this spend, take a fixed amount off. |
| **Amount off shipping** | How much to take off. |

A typical Java setup:

```
Rate up to 1kg            Rp 18.000
Discount applies over     Rp 300.000
Amount off shipping       Rp 20.000
Free shipping over        Rp 500.000
```

So: spend Rp 250.000 and pay full shipping; spend Rp 350.000 and the discount
applies; spend Rp 500.000 and shipping is free.

### Three things worth knowing

**The discount is capped at the shipping rate.** In the example above, Rp
20.000 off an Rp 18.000 rate makes shipping free rather than knocking Rp 2.000
off the coffee. That is deliberate — a shipping discount can never become a
discount on the product.

**The partial discount must start below the free threshold.** Otherwise nobody
ever reaches it, so the admin refuses to save it and the database refuses too.

**The most generous tier always wins.** A customer clearing the free threshold
gets free shipping, never the smaller discount.

### Knowing what it costs you

Free shipping is a marketing spend, and it should be looked at like one.
**Admin → Sales** shows **"Shipping you covered"** for the period, broken down
by zone. Compare it against whether the bigger baskets appeared. If you gave
away Rp 3.000.000 last month and average order value did not move, the
threshold is in the wrong place.

Every order also records what was absorbed, visible on the order in the admin.
That figure is stored on the order itself rather than recalculated, so changing
a rate card later never rewrites what past orders actually cost you.

---

## Part 2 — connecting a courier API

Right now rates are flat figures from a table you control. The alternative is
asking a courier what a specific parcel to a specific address actually costs.

### Should you?

Not yet, probably. Live rates are worth it when flat rates are visibly wrong —
when you are losing money on heavy or remote deliveries, or losing orders
because a padded rate looks expensive next to a competitor. Until one of those
is actually happening, flat zones are cheaper, faster and never break because
someone else's API is down.

The build is arranged so this stays a genuine option rather than a rewrite.

### What is already in place

Shipping is behind an interface, `ShippingProvider` in
`src/lib/shipping/types.ts`, with one implementation today
(`flat-zones.ts`). Three things were built the way a live-rate provider needs
rather than the way flat rates need:

1. **Quoting is async.** A flat rate could be computed instantly; the contract
   is a promise anyway, so an HTTP call fits without changing callers.
2. **The browser never prices shipping.** Checkout asks
   `POST /api/shipping/quote`, debounced as the address is typed. A carrier API
   key can only be used server-side, so this had to be true before live rates
   were possible at all.
3. **Weight and subtotal are recomputed server-side** from variant ids, so a
   tampered cart cannot buy cheaper shipping.

### What it actually costs

**Treat every figure here as needing confirmation.** The original build spec's
estimate was wrong, and a first correction to this file was also incomplete.
Get current numbers from the provider's own dashboard or sales team before
committing to anything.

Biteship sells two ways, and the difference matters more than the headline
price:

| Model | Roughly | Notes |
|---|---|---|
| **Pay as you go** | from ~Rp 5 per API request | No monthly commitment. Cost tracks usage. |
| **Packages** | Rp 99.000 / 149.000 / 249.000 per month | Bundled request volume plus platform features. |

RajaOngkir remains the other option, with a genuinely free Starter tier limited
to JNE, POS Indonesia and TIKI.

### The number that decides it: requests per month

The headline price is not the useful figure. What matters is how many rate
requests this site actually makes, and that is a property of our code:

- Checkout quotes from the server whenever country, province, city or postcode
  changes, debounced at 400 ms. A customer filling in an address typically
  triggers **around four requests**.
- Placing the order re-quotes once more, authoritatively. Call it **five per
  completed checkout**.
- Abandoned checkouts still cost requests. Assume roughly two abandoned
  sessions per completed order and the working figure is **~15 requests per
  order**.

At ~Rp 5 per request that is about **Rp 75 of API cost per order**. A hundred
orders a month is somewhere around **Rp 7.500** — against Rp 99.000 for the
entry package.

Break-even is roughly **20.000 requests a month**, which at the ratios above is
somewhere near **1.300 orders a month**. Well past that, a package starts
making sense; below it, pay-as-you-go is substantially cheaper.

### Keeping the request count down

If you do go pay-as-you-go, these are the levers, in order of effect:

1. **Cache quotes in `/api/shipping/quote`.** Rates for the same destination
   and weight band do not change minute to minute. Caching on
   (country, province, postcode, weight bucket) for even an hour would collapse
   most of the repeat traffic, and the quote route is deliberately the single
   place this has to be added.
2. **Quote only once the address is complete**, rather than on every field
   change. Fewer requests, at the cost of the customer seeing the shipping
   figure slightly later.
3. **Lengthen the debounce** beyond 400 ms.

None of this is worth doing before you actually integrate — but it is why the
quote endpoint exists as one chokepoint rather than being scattered.
### Adding Biteship

[Biteship](https://biteship.com) aggregates 30+ couriers and covers
international and postal-code-level domestic rates.

1. **Get an account and a key.** Sign up, complete verification, and take the
   API key from the dashboard. Add it in Vercel as `BITESHIP_API_KEY`, and set
   `SHIPPING_PROVIDER=biteship`.

2. **Write `src/lib/shipping/biteship.ts`** implementing `ShippingProvider`.
   It posts origin, destination and parcel details to Biteship's rates
   endpoint and maps the response onto `ShippingQuote`. The origin address —
   the roastery — needs to come from somewhere; add it to `site_settings` so it
   is editable in the admin rather than hard-coded.

3. **Register it** in `getShippingProvider` in `src/lib/shipping/index.ts`.
   That is the only existing file that changes.

4. **Decide what happens when the API is slow or down.** This matters more
   than the integration itself: a courier API outage must not stop people
   checking out. The sane behaviour is to fall back to the flat zone for that
   destination and carry on, because a slightly wrong shipping price is
   enormously better than a checkout that does not work. The flat zones stay in
   the database as that safety net.

5. **Decide about the discounts.** The subsidy logic in `priceZone` is part of
   the flat-zone implementation. If you want discounts to apply on top of live
   rates too — and you probably do — that logic should move somewhere both
   providers share before the second one is written.

6. **Watch the cost.** A rate query per keystroke would be expensive; the
   checkout form already debounces at 400ms, and the quote endpoint is the
   single place to add caching if it turns out to matter.

### Other options

RajaOngkir is the long-established Indonesian option and has a free tier, which
makes it the natural first thing to try if you want live rates at all.
Aggregators like Shippo or EasyPost are stronger internationally but priced in
USD, which for an Indonesian shop usually makes them the expensive choice.

All of them fit the same `ShippingProvider` interface, so the integration work
is the same whichever you pick, and switching later is one file plus one
environment variable. That is the point of the seam: you are not locked into
whichever you try first.
