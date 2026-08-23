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

**Saving a tracking number ships the order.** It sets the status to shipped and
records the date, as well as emailing the customer — those used to be three
separate things, and the customer could be told a parcel was on its way while
the admin still said it was only paid.

Marking an order **Shipped** also records *when*, the first time you do it.
Re-selecting it later will not move that date, and neither will anything else —
if the parcel actually went out yesterday and you only got round to the site
today, correct the date by hand (below) and it will stay corrected.

**Cancelling** an unpaid order puts its coffee back on the shelf. Cancelling one
that was already paid does not — that coffee has left the building, and undoing
it is a refund and a fresh stock count, which is a decision for you rather than
something the site should guess at.

## Finding an order

The orders list has a search box above the filters. It looks at the reference,
the customer's name, their phone number, the WhatsApp number or Instagram
handle, the tracking number, the city and the customer's note — so "anwar",
"0812", "sleman" or "MAN-0001" all find the same order.

Search and the filters work together, and the result is a normal web address:
bookmark a search you run often, or send it to somebody.

## Fixing an order after the fact

Open the order and scroll to **Correct the details**. It is for fixing what was
written down, not for changing what happened — nothing in that panel moves
stock, money or points.

You can change:

- **Came in through** and **Reference** — if you filed a WhatsApp order under
  Instagram, or typed the wrong number. Changing the channel moves the sale in
  the sales report too, which is usually the point.
- **Placed at** — when the order was actually agreed, which is not always when
  you typed it up. An order taken on Friday and written up on Monday belongs on
  Friday. It will refuse a date in the future.
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

## Undoing an order you entered wrong

**Cancelled** and **voided** say different things, and picking the right one
keeps your books honest.

- **Cancelled** — the order was real and is not going ahead. It stays in your
  records as an order that happened and then stopped.
- **Voided** — the order was never real. You rang up the wrong coffee, or typed
  the same WhatsApp order in twice. It should not be in the day's takings at
  all, because it never took any money.

Voiding is on the order page, under **Entered by mistake?**. It puts everything
back: coffee returns to the shelf, any loyalty points are taken back off the
customer (as a second line in their points history, so it still adds up), and
the order disappears from every report and total. It keeps the record, marked
void, so there is still a trace that something was entered and undone.

You can **put a voided order back** if you voided the wrong one. That takes the
coffee off the shelf again — so it will refuse if the coffee has since been
sold to somebody else, and tell you to fix the stock first.

To find voided orders again, use the **Voided** filter on the orders list.

### Deleting for good

Once an order is voided, the same panel offers **Delete permanently**. This
removes the record entirely and cannot be undone, so you have to type the
order's reference to confirm it.

You cannot delete an order that has not been voided first. Voiding is what puts
the stock and points back; deleting only removes the record, and doing it to a
live order would quietly leave your stock wrong.

**Website orders can be neither voided nor deleted.** A real payment went
through a real payment provider for those, and your records need to keep
matching what the customer was actually charged. Cancel them instead.

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
- **Collecting or Shipping** — Shipping opens an address form. Type a few
  letters of the kelurahan or kecamatan into the search box and pick from the
  list: provinsi, kota, kecamatan, kelurahan and the postcode all fill in, and
  the order remembers the courier's own code for that place, which is what
  makes the ongkir accurate. Every field stays editable underneath, so a place
  the lookup does not know is still deliverable. If you attached a
  customer who has ordered before, their saved addresses appear above it as
  one-tap buttons. There is also a box for the shipping you agreed with them,
  since a chat order is often a negotiated price rather than a table rate.
- **Not paid yet or Already paid** — the important one, below.

Press the button and the order appears in **Orders** alongside the website
ones, with the same statuses and the same tracking-number box.

**The customer gets emailed like any other**, as long as you put an email
address on the order: a receipt when it is paid, and the tracking number when
it goes out. Counter sales send nothing — the customer is standing in front of
you holding the coffee.

### Bulk prices and discounts

**Custom price or discount** under the basket opens two things.

- **Type over a price** on any line for a wholesale or bulk rate — 5kg to a
  cafe is not sold at the 200g shelf price. It applies to that order only; the
  shop price does not change, and the order keeps a record of what was actually
  charged.
- **Discount off the coffee** takes an amount off the whole order. It asks what
  for, because a discount with no reason is indistinguishable from a mistake a
  month later. Shipping is not touched — that is subsidised separately, so the
  two never have to be untangled.

A discount bigger than the order is treated as "this one is free" rather than
refused. Prices left alone still come from the catalogue and cannot be
influenced from the screen at all.

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
- **Shipping you covered** — counts postage on every channel. Website orders
  are grouped by their shipping zone; postage you agreed in a chat is grouped
  as "agreed by hand", since there was no zone involved.

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

## Rewording a page

**Admin → Pages → Jasa Roasting.** The heading and the paragraph under it have
always been editable. Now so is everything else on that page: the four steps,
the WhatsApp nudge, and every label inside the quote form — "Your name", the
button, the message people see after sending.

Each box shows the wording it came with as grey placeholder text. Type over it
to change it; **clear a box to go back to the original**. You can never end up
with a blank label, because an empty box means "use the built-in wording"
rather than "show nothing".

Two useful details:

- **Roast levels offered** is one option per line. Rewrite the list to change
  what customers can pick from.
- **Emptying both boxes for a step removes that step** from the page, if you
  only want three.

This is set up for the roasting page for now. The other pages still only offer
their heading and paragraph.

## Addresses

Addresses are shaped like Indonesian addresses: **kelurahan** and **kecamatan**
have their own fields, between the street and the kota. Those two used to be
missing entirely, which is why people ended up typing an entire address into
the street box.

Both the checkout and the manual-order form have a **search** above them. Type
part of a kelurahan or kecamatan and pick from the list; everything below fills
in, including the postcode. The list comes from the courier's own database, so
what the customer picks is a place the courier recognises — which is the
difference between an accurate ongkir and a guess.

If the lookup is unavailable — no courier API key, or their service is down —
the search quietly says so and every field can still be typed. Nobody is ever
unable to give their address because a courier is having a bad afternoon.

Addresses saved before this existed are still perfectly good. They simply carry
less detail, and are priced from the postcode as they always were.

## Points for people without an account

Somebody who orders over WhatsApp has usually never touched the website, and
used to earn nothing. Now the points are **held against whatever contact detail
the order carries** — their email if there is one, otherwise their phone number
— and wait for them.

- **If they sign up with that email**, the points land on their account the
  first time they open it, and they are told so. Nothing for you to do.
- **If the points are held against a phone number**, you hand them over: open
  the customer in **Customers & loyalty**, find **Collect earlier points**, and
  type the number the orders came from.

That split is deliberate. An email address is confirmed — the person had to
open a link, or sign in with Google. A phone number is not: it is whatever was
typed into a form, so if points followed phone numbers automatically, anyone
who entered a number that had been buying coffee would walk off with somebody
else's balance. Handing those over is a judgement about whether this is the
right person, and that is yours to make.

Phone numbers are matched however they are written — `0812…`, `+62 812…` and
`62812…` are one customer, not three.

Voiding an order takes its held points back out again, the same as it does for
a customer with an account.

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
