# Running the shop

Day-to-day guide for the admin dashboard at `/admin`. You never need Supabase
or code for anything on this page.

---

## The daily loop

Open **Admin → Overview**. It answers "what needs me today":

- **Paid, ready to roast** — money has cleared, these need roasting.
- **Awaiting payment** — placed but not paid. They expire on their own.
- **New roasting requests** — someone wants a quote.
- **Unmatched payments** — money arrived that could not be tied to an order.
  Only appears when there is something to fix.

## Moving an order along

Open the order and use the status dropdown:

| Status | Means |
|---|---|
| Awaiting payment | Placed, money not in yet. Set automatically. |
| Paid | Money confirmed. Set automatically when payment clears. |
| Roasting | You are working on it. |
| Shipped | It has left. Add the tracking number so the customer can see it. |
| Completed | Delivered and done. |
| Cancelled | Not going ahead. |

**One thing to be careful with:** setting an order to **Paid** by hand does
everything a real payment does — it takes stock down and awards loyalty points.
Only use it when you have genuinely confirmed the money arrived. Doing it twice
is safe; the second time changes nothing.

## Selling in the shop

**Admin → Counter sales.** This is the till.

Tap a size to add it to the sale; tap again for a second bag. The total is the
big number at the bottom. Pick how they paid, then press the green button.

- **Cash** — tap the note they handed you (or **Exact**), and the screen tells
  you the change to give. You can also type an unusual amount.
- **QRIS, card, transfer** — just pick it and take the payment on your own
  device, then press the button to record it.
- **Add customer for points** — search their name or email. Their points go up
  exactly as they would online. Skip it for a walk-in; the sale still records
  fine, it just earns nobody anything.

The sale is recorded the moment you press the button. Stock comes down straight
away, so **the website cannot sell a bag you just sold over the counter**. That
is the main reason to ring sales up here rather than in a notebook.

If something is out of stock, the till says so and refuses the sale rather than
letting you sell what you do not have. If that happens and you know the stock
figure is wrong, fix it in **Products** and ring the sale up again.

## Seeing how the business is doing

**Admin → Sales.** Today, the last 7 days, or the last 30.

- **Total takings**, split into **shop** and **online**, so you can see which
  side is carrying the month.
- **Cash to count** — what should be in the drawer. Count the drawer against
  this at the end of the day; if they disagree, something was rung up wrong.
- **What sold** — every coffee and size, with shop and web columns side by
  side. This is the roasting list for next week.

## Adding a coffee

**Admin → Products → New product.**

- **Name** and **tasting notes** are what people read first.
- Set a **price** for each size you want to sell. Leave a size at 0 and it
  simply does not appear on the shop.
- **Stock** is the number of bags you have. It comes down automatically as
  orders are paid for — you only top it up after a roast.
- **Card accent colour** is the block of colour behind the coffee on the shop
  grid. Pick something that suits the bag.
- Uncheck **Show on the shop** to take it down without deleting it.

**Restocking after a roast:** open the product, change the stock numbers, save.
That is the whole job.

**A new lot of something you have sold before:** open the old one, click
**Duplicate**, then edit. The copy starts hidden with zero stock, so you can
get it right before anyone sees it.

## Changing the order coffees appear in

**Admin → Products.** Drag a row, or use the up/down arrows, then click **Save
order**. The shop follows that order immediately.

To put something on the homepage, tick **Feature on the homepage** when editing
it.

## Writing a post

**Admin → Journal → New post.**

Write in the big box. The buttons above it handle headings, bold, quotes, lists
and links — you never need to type a symbol yourself. **Preview** shows roughly
how it will read.

Three states:

- **Draft** — only you can see it. Save as often as you like.
- **Scheduled** — set a publish date and it goes live on its own.
- **Published** — live now.

Give it a **category** so it appears in the right section of the archive, and
**tags** (comma-separated) so related posts link up.

To put one post at the top of the archive, use the **Pinned** dropdown on the
Journal list.

## Quoting a roasting job

**Admin → Roasting requests.** Open jobs are at the top.

Each shows the customer's details, what they have, and how much. The phone
number is a WhatsApp link — tap it to reply. Then set a **quote**, change the
**status** to `quoted`, and save. Add an internal note to remind yourself where
things stand.

## Points and tiers

Points are awarded automatically on paid orders. Guest orders earn nothing,
which is the main reason to encourage accounts.

**Admin → Customers** lists everyone. Open someone to:

- **Adjust points** — positive to give, negative to take away. Always write a
  reason; it shows in their history and yours.
- **Set tier** by hand if you want to override what their points say.
- **Make an admin** — give your partner dashboard access. The system will not
  let you remove the last admin, so you cannot lock yourself out.

To change how points are earned, go to **Admin → Site settings → Loyalty**.
Changes apply from then on; past orders are not recalculated.

## Unmatched payments

Only relevant on the bank-transfer setup. If a customer types the wrong amount,
the payment cannot be matched to their order, and it lands in
**Admin → Payments**.

Pick the right order from the dropdown and click **Resolve** — that settles it
exactly as an automatic payment would, stock and points included. If it was not
a customer payment at all, leave the dropdown on "not a payment" and resolve it
to clear it off the list.

## Changing how the site looks

**Admin → Site settings** covers the parts that are safe to change while the
shop is open:

- **Hero** — the big headline block at the top of the homepage.
- **Announcement banner** — the thin strip above the menu. Good for a sale, a
  holiday closure, or a new lot. Turn it off when it stops being true.
- **Homepage categories** — which groups of coffee show on the front page, and
  in what order.
- **Contact** — WhatsApp, Instagram and email, used in the footer and on the
  roasting page.
- **Search engines** — the title and description that show on Google.

Anything beyond this — page layout, spacing, new kinds of pages — is a code
change. That is deliberate: it keeps the dashboard something you can use
confidently without being able to break the site.

## Images and storage

Your Supabase free plan allows 1 GB of stored images and 5 GB of transfer a
month. The previous setup ran into this; this one is built not to.

**You do not need to resize photos before uploading.** Whatever you pick —
straight off your phone, straight out of the camera — is shrunk in your browser
before it is sent. A 6 MB photo typically becomes about 200 KB, and the
uploader tells you what it did ("Shrunk from 6.2 MB to 190 KB"). At the sizes
the site actually displays, there is no visible difference.

**Check on it occasionally** at **Admin → Site settings → Images & storage**.
It shows how much of the 1 GB is used, and turns amber past halfway.

**Clear out unused files** from the same page. Replacing a product photo does
not overwrite the old one — it uploads a new file and leaves the old one behind
— so these build up over time. The page lists everything nothing points at any
more and deletes them in one click. Anything uploaded in the last day is left
alone, so a half-finished product you have not saved yet is never touched.

The one thing to avoid: uploading images you do not intend to use, over and
over. Everything else is handled.

## Shipping rates

**Admin → Site settings → Shipping rates.**

Each zone has a rate up to 1kg and a rate above it, plus an optional
free-shipping threshold. Indonesian orders pick between the two domestic zones
automatically based on the province. Everywhere else matches on country, with
"Rest of world" catching anything not listed.

You can also set **discounts**: free shipping above a spend, and optionally a
smaller fixed discount above a lower spend. **Admin → Sales** then shows
"Shipping you covered" so you can see what that is costing before deciding the
thresholds are right.

If you raise a rate, it applies to new orders only. Orders already placed keep
the price they were quoted.

Full detail, including what it would take to switch to live courier rates
later, is in [SHIPPING.md](SHIPPING.md).
