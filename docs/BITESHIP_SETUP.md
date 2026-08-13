# Setting up Biteship — plain version

For Ebi. No code, no jargon. If something here is still confusing, that is a
problem with the instructions, not with you — say so and it gets rewritten.

---

## Never set up an API before?

You have, actually — three times already in this project. Supabase, Vercel and
Xendit were all the same job. It just was not called that.

**Every one of these is the same three steps, always:**

1. Log into someone's website and click a button that says *create key*
2. Copy the long string of characters it gives you
3. Paste it into Vercel's Environment Variables

That is it. That is the whole skill. There is nothing to install, nothing to
configure, no code to write. If you can copy and paste, you can do this.

An **API key** is just a password that a website uses instead of a person. When
our website asks Biteship "what does this parcel cost?", Biteship needs to know
who is asking — the key is how it knows. Nothing more mysterious than that.

**If your only experience is Google, you have done the hardest one.** Google
Cloud makes you pick a project, enable specific services, choose between API
keys and OAuth and service accounts, and fill in a consent screen. Biteship is
one button that gives you one key.

### What you will actually have to do here

Your entire job, start to finish:

- flip one toggle (Testing Mode)
- click three buttons to make a key
- copy that key into Vercel, next to the ones already there

Everything else — the code, the testing, the switching over — is mine.

### What happens if you get it wrong

Very little, and all of it is undoable:

- **Testing Mode means nothing is real.** No courier is booked, no money moves.
- **Keys are free and disposable.** Made a mess, or pasted one somewhere you
  should not have? Delete it in the Biteship portal, click the button again,
  get a new one. There is no cost and no limit.
- **The website does not depend on any of this.** It uses your own price list
  today and keeps using it until we deliberately switch over. If Biteship is
  down, or the key is wrong, or we never finish — the shop carries on selling
  exactly as it does now.

There is no step in this where you can break the live shop. That is deliberate.

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

## The code is written

The part that talks to Biteship is done and tested against a stand-in for their
service. It handles the four things that actually happen in practice:

- **They answer normally** — the cheapest courier's price is shown to the
  customer, with their delivery estimate.
- **They are down or slow** — the website quietly uses your own price list
  instead. The customer notices nothing.
- **The key is wrong** — same fallback, but it also shouts in the logs, because
  that will not fix itself.
- **They answer in a format we did not expect** — same fallback again.

In every failure case the shop keeps selling. That was the point.

Your free-shipping and discount thresholds work exactly the same either way, and
international orders never touch Biteship at all — they stay on your own zone
prices, which is cheaper and simpler.

---

## What happens after that

1. **You paste the test key into Vercel** as `BITESHIP_API_KEY`, and add
   `SHIPPING_PROVIDER=biteship` next to it. Then redeploy.
2. **Fill in your pickup address** in Admin → Site settings → Shipping rates.
   Biteship needs to know where parcels come from — the postcode especially.
   Without it the site just keeps using your own price list.
3. **Try a checkout** with a real Indonesian address and see what price comes
   up. Compare it against what that delivery actually costs you.
4. Try a few different destinations — somewhere in Java, somewhere far away.
5. If the numbers look right, make a **live** key and swap it in.

Two things I will want to hear from you at step 3, because they are the two
things I could not verify without a real account:

- **Does a price come back at all?** If it always shows your own flat price,
  something is not connecting and I will need the error from the Vercel logs.
- **Is the price sensible?** Roughly what that courier would charge for a bag
  of coffee. If it is wildly out — ten times too much or too little — that
  points at the parcel weight being misread, which is a one-line fix.

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
