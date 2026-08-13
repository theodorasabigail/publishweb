# Setting up Biteship — plain version

For Ebi. No code, no jargon. If something here is still confusing, that is a
problem with the instructions, not with you — say so and it gets rewritten.

---

## What we are actually trying to do

Right now the website works out shipping costs from a **price list you set
yourself** — Java is Rp 18.000, outside Java is Rp 32.000, and so on. You
control those numbers in Admin → Site settings → Shipping rates. It costs
nothing and it never breaks.

Biteship would replace that with **asking the courier what this exact parcel to
this exact address really costs**. More accurate, but it costs money per
question asked and it can break when their service is down.

That is the whole idea. Everything else is detail.

---

## Do this in three stages, not all at once

There are three separate things people mean by "connecting Biteship". They are
easy to confuse, and doing them in the wrong order wastes effort.

**Stage 1 — Live prices.** The website asks Biteship "what does this cost?" and
shows the customer that number instead of your price list. Nothing else
changes: you still book the courier yourself, the way you do now.

**Stage 2 — Booking pickups.** The website tells Biteship "come and collect
this parcel" automatically when an order is paid. This is a bigger change to
how you work each day.

**Stage 3 — Automatic tracking.** Biteship tells the website when a parcel is
picked up and delivered, so the tracking number appears on the customer's order
by itself and you never copy one across again.

**Stage 1 is where the value is, and it is the smallest.** Stages 2 and 3 only
matter once Stage 1 has been running long enough for you to know live prices
are actually better than your own list.

> **Webhooks are Stage 3.** You mentioned you can create them in the portal.
> You can — but a webhook is Biteship telling us about **a parcel it is
> handling**, and it will not be handling any until Stage 2. If you create one
> today it will sit there and never do anything. So: not yet. It is already
> built and waiting on our side.

---

## What to do right now

Only two things, and neither takes long.

### 1. Switch the portal into Testing Mode

In the Biteship dashboard there is a **"Testing Mode"** toggle in the sidebar.
Turn it on.

This gives you a safe sandbox: nothing you do books a real courier or costs
real money. We do all the setting up here first.

### 2. Create a test API key

An "API key" is just a long password that lets the website talk to Biteship on
your behalf. Making one does not cost anything and does not commit you to
anything.

1. Go to **https://dashboard.biteship.com/integrations**
2. Click **"Pengaturan"**
3. Click **"Tambah Kunci API"**
4. Give it a name — `website` is fine
5. It shows you the key **once**. Copy it somewhere safe immediately.

A test key starts with `biteship_test.` — that prefix is how the website checks
you have not accidentally used a real one while testing.

> ### Do not paste the key into a chat message
>
> Not to me, not to anyone. It is a password. Anyone who has it can book
> couriers and spend money as you.
>
> When the time comes it goes into **Vercel → Settings → Environment
> Variables**, the same place the Supabase and Xendit keys already live, and
> nowhere else. If it ever ends up somewhere it should not, delete it in the
> Biteship portal and make a new one — that costs nothing.

---

## The one thing blocking us

To ask Biteship for a shipping price, the website has to send the question in
exactly the format they expect, and understand exactly the format they answer
in.

**I cannot open biteship.com from where I work** — the network here blocks it.
So I need you to fetch that one page for me.

In the Biteship documentation, find the page about **Rates API** — the one that
covers `/v1/rates/couriers`, probably called something like "Retrieve Rates",
"Rates by postal code", or similar. It will show a block of example code with
curly braces `{ }` — a sample question, and a sample answer.

**Copy that whole page and paste it into the chat.** All of it, including the
code blocks. That is genuinely everything I need to finish Stage 1.

Guessing that format is not an option — it produces something that looks
correct and fails the moment it is used for real, which is the worst kind of
broken.

---

## What happens after that

1. I write the part that talks to Biteship, and test it against your sandbox.
2. You paste the test key into Vercel.
3. We check prices on the website against what the courier actually charges,
   for real addresses, across a few different zones.
4. If the numbers look right, you make a **live** key and we switch over.
5. Your own price list stays in the database as a safety net. If Biteship is
   ever slow or down, the website quietly falls back to it and customers can
   still check out. Nothing to do on your end.

You can stop at any of those steps and nothing breaks — the site keeps using
your own price list until we deliberately switch it over.

---

## Two things to ask Biteship support

Their support is at **support@biteship.com**. Two questions worth asking now,
because the answers change what we build:

1. **"Is there a minimum monthly spend on the pay-as-you-go API pricing?"**
   Their per-request price looks much cheaper than the Rp 99.000/month package
   for a shop your size, but only if there is no floor under it.

2. **"Do your webhooks include a signature so we can verify they really came
   from you?"** Their documentation does not mention one. We have worked around
   it safely, but if they do offer signing we should use it instead.
