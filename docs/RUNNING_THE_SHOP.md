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

Marking an order **Shipped** also records *when*, the first time you do it.
Re-selecting it later will not move that date, and neither will anything else —
if the parcel actually went out yesterday and you only got round to the site
today, correct the date by hand (below) and it will stay corrected.

**Cancelling** an unpaid order puts its coffee back on the shelf. Cancelling one
that was already paid does not — that coffee has left the building, and undoing
it is a refund and a fresh stock count, which is a decision for you rather than
something the site should guess at.

## Fixing an order after the fact

Open the order and scroll to **Correct the details**. It is for fixing what was
written down, not for changing what happened — nothing in that panel moves
stock, money or points.

You can change:

- **Came in through** and **Reference** — if you filed a WhatsApp order under
  Instagram, or typed the wrong number. Changing the channel moves the sale in
  the sales report too, which is usually the point.
- **Paid at** and **Shipped at** — both in Jakarta time. Useful when the money
  landed on Friday but you only recorded it on Monday, or when the parcel went
  out before you updated the site.
- **The address** — including the name. Clearing the name empties the address
  entirely, which turns the order into one the customer is collecting.

Two things it will not let you do, on purpose:

- **Give a payment date to an order that has not been paid.** Typing a date
  would make the order *look* settled while its coffee is still on the shelf
  and its points were never awarded. Use the status control instead — that does
  the real work.
- **Remove the payment date from an order that has been paid.** If it was
  marked paid by mistake, cancel it rather than quietly un-paying it.

## Selling in the shop

**Admin → Counter sales.** This is the till, and it has two modes across the
top: **Counter sale** for someone standing in front of you, and **Manual order**
for one that came in over WhatsApp, Instagram or a marketplace.

Both use the same product grid and the same basket. Only the questions on the
right differ.

### Counter sale

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

### Manual order — WhatsApp, Instagram, a marketplace

Switch to **Manual order** and build the basket the same way. Then answer three
questions the counter never has to ask:

- **Came in through** — WhatsApp, Instagram, Marketplace or somewhere else, plus
  their number or handle. That is what lets you find the conversation again in a
  fortnight when they ask where it is.
- **Collecting or Shipping** — Shipping opens an address form. If you attached a
  customer who has ordered before, their saved addresses appear above it as
  one-tap buttons. There is also a box for the shipping you agreed with them,
  since a chat order is often a negotiated price rather than a table rate.
- **Not paid yet or Already paid** — the important one, below.

Press the button and the order appears in **Orders** alongside the website
ones, with the same statuses and the same tracking-number box.

### Coffee that is held but not yet sold

An order agreed on WhatsApp is usually paid later. Between the two, the site
**holds** that coffee: it stays on your shelf and in your stock figure, but the
website will not sell it to anybody else, and neither will the till.

You will see this in three places:

- On the till, a size shows `3 left` and `2 held` underneath.
- In **Products**, a coffee shows `10 in stock` and `2 held · 8 free`.
- In **Orders**, the order itself is tagged **holding stock**.

A hold ends one of two ways. Mark the order **Paid** and it becomes a real
stock reduction. **Cancel** it and the coffee goes back on the shelf. Nothing
expires on its own, on purpose — a hold is a promise you made to a customer,
and the site should not quietly break it. The cost is that an order nobody ever
chases keeps its coffee off the website indefinitely, so it is worth glancing
down the **Awaiting payment** list every couple of weeks and cancelling the ones
that clearly fell through.

## Seeing how the business is doing

**Admin → Sales.** Today, the last 7 days, or the last 30.

- **Total takings**, split into **shop**, **online** and **by hand**, so you can
  see which side is carrying the month. The by-hand card only appears once there
  is something in it.
- **Cash to count** — what should be in the drawer. Count the drawer against
  this at the end of the day; if they disagree, something was rung up wrong.
- **What sold** — every coffee and size, with shop, web and by-hand columns side
  by side. This is the roasting list for next week.

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

**If storage does get full**, uploads stop with a message rather than failing
strangely — a warning from 80% and a hard stop at 95%, both pointing at the
cleanup page.

The one thing to avoid: uploading images you do not intend to use, over and
over. Everything else is handled.

### Will this stay inside the free plan?

At the scale of a small roastery, comfortably. Shop and journal pages are
served from a cache rather than the database, so ordinary browsing costs you
nothing at all — a hundred people reading the blog does not touch Supabase.
Images are shrunk on upload and then cached, so each one is fetched from
Supabase a handful of times a month rather than once per visitor.

What would change that is real scale — thousands of visitors a day — and at
that point the paid plan is a rounding error against the orders that brought
them. Check Supabase's usage page every month or two; you should see the bars
barely moving.

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

Thinking about live courier rates instead of your own price list?
[BITESHIP_SETUP.md](BITESHIP_SETUP.md) walks through it in plain language —
including which parts are worth doing and which are not worth it yet.
