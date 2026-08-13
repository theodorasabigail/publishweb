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
### Biteship's five phases, mapped to this project

Biteship publishes a five-phase integration timeline. Here is what each phase
actually means here, and who does it.

**1 — Planning and preparation.** *You:* create the Biteship account, enable
sandbox mode, and get the test API key. *Already done here:* the provider
interface, the server-side quote endpoint, and the pickup address in
Admin → Site settings → Shipping rates. *Still needed from Biteship:* the API
reference for the rates endpoint — the exact URL, the auth header format, the
request body shape, and the response shape.

**2 — Core integration.** Authentication and rate calculation are one file,
`src/lib/shipping/biteship.ts`, implementing `ShippingProvider`, plus one line
registering it in `getShippingProvider`. Nothing else changes: checkout, the
quote endpoint and the order record all already talk to the interface.

Order creation and webhooks are a **separate decision from rates**, and worth
separating in time too. Live *rates* only affect what the customer is quoted.
Booking a pickup and receiving tracking webhooks changes how orders are
fulfilled, and touches the admin. Doing rates first is lower risk and delivers
most of the value.

**3 — Advanced features.** Tracking updates would populate `tracking_number` on
the order automatically instead of the operator pasting it in. Error handling
is the important half: see the fallback note below.

**4 — Testing and refinement.** Biteship requires an activation form before
live keys are issued. Budget time for that — it is a human review step, not a
button. Test in sandbox against real addresses across several zones, and
specifically test what happens when their API is unreachable.

**5 — Go live.** Swap the sandbox key for the live one and set
`SHIPPING_PROVIDER=biteship`. Rolling back is setting it to `flat_zones` again,
which is worth knowing before launch rather than during an incident.

### Confirmed API details

From Biteship's own documentation. These are the facts the provider file will
be built on.

**Rates endpoint**

```
POST https://api.biteship.com/v1/rates/couriers
```

One endpoint, five request styles: by coordinates, postal code, area id, mixed,
or by type. Postal code is the obvious starting point — checkout already
collects one, and it needs no extra lookup call. Area id is more accurate but
means resolving an address to a Biteship area first, which is a second request
and therefore a second charge.

**Authentication — their docs contradict themselves here.** The prose says HTTP
Basic auth with the token as the password, which would mean:

```
Authorization: Basic <base64 of ":" + token>
```

Their curl example shows the raw token instead, with no scheme:

```
authorization: <<YOUR_API_KEY>>
```

Those are not the same request. Concrete examples usually survive doc rot
better than prose, so the raw header is the one to try first — but this is the
first thing to check in sandbox, because getting it wrong returns a generic
auth failure rather than anything that points at the cause.

Tokens are prefixed `biteship_test.` or `biteship_live.`, which is worth
asserting on at startup: a live key in a staging deploy is a real mistake and
the prefix makes it catchable.

**Auth error codes** — `40000001`, `40101001`, `40101002`, `40101003`,
`40301001`, `40301002`.

These matter for the fallback design. An auth error is **not** a transient
failure: retrying will not fix a wrong key. It should fall back to flat zones
*and* surface loudly to the operator, because it means shipping quotes are
silently no longer live. A timeout or a 5xx is different — fall back quietly
and carry on. Treating both the same would either spam the operator or hide a
broken key for weeks.

### The webhook that changes a business rule

Biteship fires three webhooks: `order.status`, `order.waybill_id`, and —
the important one — **`order.price`**:

> Price changes when the actual weight is different from the weight used to
> calculate the price.

So the courier can charge a different amount **after** the customer has already
paid. That is not a technical detail, it is a policy question, and it needs an
answer before order booking goes live:

- **Absorb it.** Simplest, and invisible to the customer. The order already has
  `shipping_discount_idr` for recording what the roastery covers, so an
  unexpected overage can be recorded the same way and show up in
  Admin → Sales under "Shipping you covered".
- **Chase the customer for the difference.** Almost never worth it on a bag of
  coffee, and it makes for a bad email.
- **Absorb it, but get told when it is large.** Probably the right answer: a
  flag in the admin when the courier's figure exceeds the quote by more than
  some threshold, so a systematically wrong parcel weight gets noticed rather
  than quietly eating margin.

This is a strong argument for **quoting generously** on live rates rather than
to the rupiah, and for keeping product `weight_grams` accurate — that field is
currently only used for flat-rate weight tiers, but it becomes the basis of
every quote once rates are live.

### Realistic timeline

Biteship estimates 1 week to 2 months overall, with core integration at 2-4
weeks. That is for the full scope: rates, order creation, webhooks, tracking,
labels.

**Rates only is far smaller** — one provider file against an interface that
already exists, and the fallback behaviour. The long poles in their timeline
are order booking, webhook handling and the activation review, none of which
rates needs. Which is the case for doing rates first and deciding about
booking afterwards, once live quotes have been running long enough to know
whether they are actually better than the flat zones.

Note that the activation request sits in their Testing phase, and testing-mode
keys have the Order API active by default while live keys do not. So sandbox
work is not blocked on the review, but going live with order booking is.

### What is built already

`src/lib/shipping/biteship.ts` — auth header (with the raw/Basic switch in one
place), token-prefix checking so a live key cannot run on a preview deploy,
failure classification separating auth errors from transient ones, and webhook
parsing for all three events.

`POST /api/webhooks/biteship` — receives `order.status`, `order.price` and
`order.waybill_id`. Configure the URL in the Biteship dashboard as:

```
https://your-domain.com/api/webhooks/biteship?token=<BITESHIP_WEBHOOK_SECRET>
```

Every event is written to `courier_events` before anything is acted on, so an
unexpected payload can be inspected rather than lost, and events that do not
match one of our orders are kept as unmatched rather than dropped.

What it does with each:

- **order.status** — records waybill, courier, service and driver; copies the
  waybill into the customer-facing tracking number; and moves our order status
  forward on `picked`/`in_transit`/`delivered`. Never backwards, never off a
  cancelled order, and an unrecognised status changes nothing.
- **order.waybill_id** — updates the tracking number, since a waybill can
  change when a parcel switches courier mid-route.
- **order.price** — records `courier_charged_idr` **alongside** `shipping_idr`,
  never over it. What the customer paid is settled and stays settled.

Overcharges above `courier_variance_alert_idr` (default Rp 10.000, in site
settings) show on the order in the admin, with a note that a repeat offender
probably has the wrong `weight_grams`.

Verified against the exact payloads in Biteship's documentation, plus null,
arrays, missing fields and unknown event types.

### Still needed before writing the rates provider

The request and response bodies for `POST /v1/rates/couriers`. The endpoint,
auth and error codes are known; the payload shape is not, and guessing it
produces code that looks right and fails on first contact.

Also worth asking Biteship support: **is there a webhook signature?** Their
docs do not mention one, so the shared secret above is a workaround. If signing
exists it should replace it.

### Other options

RajaOngkir is the long-established Indonesian option and has a free tier, which
makes it the natural first thing to try if you want live rates at all.
Aggregators like Shippo or EasyPost are stronger internationally but priced in
USD, which for an Indonesian shop usually makes them the expensive choice.

All of them fit the same `ShippingProvider` interface, so the integration work
is the same whichever you pick, and switching later is one file plus one
environment variable. That is the point of the seam: you are not locked into
whichever you try first.
