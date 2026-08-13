# Setting up the website

This is the one-time setup, written for someone who does not code. Follow it in
order. Nothing here asks you to edit code — you will be copying values from one
website and pasting them into another.

Set aside about an hour. If you get stuck on a step, stop there rather than
skipping ahead; each step depends on the one before it.

**Two things worth knowing before you start:**

- Some of these values are passwords in all but name. Never paste one into a
  chat, an email, or a screenshot. The one marked "service role" is the most
  sensitive: it can read and change everything in your shop.
- Every time you change a setting in Vercel, you must **redeploy** for it to
  take effect. There is a reminder at each point where this matters.

---

## Step 1 — Supabase (your database)

Supabase stores your products, orders, customers and blog posts.

1. Go to **https://supabase.com** and create a free account.
2. Click **New project**.
   - **Name:** `publish-coffee`
   - **Database password:** click Generate, then **save it in your password
     manager**. You will rarely need it, but it cannot be recovered.
   - **Region:** Southeast Asia (Singapore) — closest to Indonesia.
3. Wait for the project to finish setting up (a minute or two).
4. In the left sidebar, click **SQL Editor**, then **New query**.
5. Open the file `supabase/setup.sql` from this project. Copy **all** of it —
   it is long, so use Ctrl+A / Cmd+A inside the file rather than scrolling —
   paste it into the query box, and click **Run**.

   You should see **"Success. No rows returned."** That one file is your whole
   database: every table, every security rule, the counter-sales till, the
   shipping discounts, and some
   example coffees and blog posts so the site is not empty on day one. You can
   edit or delete all the examples later from the admin dashboard.

   If you are unsure whether it ran, it is safe to run again — it will not
   duplicate anything or overwrite settings you have changed.

### Get your three keys

6. In the sidebar, click **Project Settings** (the gear), then **API**.
7. You need three values. Copy each into a note for now:

   | On the Supabase page | Call it |
   |---|---|
   | **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` |
   | **anon public** key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
   | **service_role** key (click "Reveal") | `SUPABASE_SERVICE_ROLE_KEY` |

> The **service_role** key is the master key to your shop. It goes into Vercel
> and nowhere else. If it ever leaks, come back to this page and click
> **Reset** next to it.

### Turn on Google sign-in (optional, do it now if you want it)

8. Sidebar → **Authentication** → **Providers** → **Google** → toggle on.
    Supabase shows you what to do; it involves creating a free Google Cloud
    project. If you would rather skip this, customers can still sign up with
    email and password — everything works without it.

---

## Step 2 — GitHub (where the code lives)

Vercel deploys your website from GitHub. If someone has already put this
project on GitHub for you, skip to Step 3.

1. Go to **https://github.com** and create a free account.
2. Create a **new repository** called `publishweb`. Keep it **Private**.
3. Whoever set this project up pushes the code to that repository.

---

## Step 3 — Vercel (the hosting)

1. Go to **https://vercel.com** and sign up **with your GitHub account** —
   this saves a step later.
2. Click **Add New → Project**.
3. Find the `publishweb` repository and click **Import**.
4. **Before clicking Deploy**, open **Environment Variables** and add the
   three values from Step 1:

   ```
   NEXT_PUBLIC_SUPABASE_URL       = https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY  = eyJhbGciOi...
   SUPABASE_SERVICE_ROLE_KEY      = eyJhbGciOi...
   ```

   Add one more, which you will correct in Step 5 once you have a domain:

   ```
   NEXT_PUBLIC_SITE_URL           = https://publishweb.vercel.app
   ```

5. Click **Deploy** and wait. When it finishes, click the preview — your shop
   should be live with the example coffees on it.

---

## Step 4 — Make yourself an admin

Right now nobody can open the admin dashboard, including you. This is the one
step that needs the Supabase SQL editor, and it is the last time you will need
it.

1. On your new website, go to `/signup` and create an account with the email
   you want to use to run the shop. Confirm the email if asked.
2. Back in Supabase → **SQL Editor** → **New query**, paste this, replacing the
   email with yours:

   ```sql
   update public.profiles
      set is_admin = true
    where email = 'you@example.com';
   ```

3. Click **Run**. It should say "Success".
4. Go back to your website and open `/admin`. You are in.

> To give your partner access later, you do **not** repeat this. Have them sign
> up normally, then open **Admin → Customers**, click their name, and press
> **Make an admin**.

---

## Step 5 — Your domain

1. In Vercel, open your project → **Settings** → **Domains** → **Add**.
2. Type your domain (for example `publishcoffee.com`) and follow the
   instructions. Vercel tells you exactly which records to create at whoever
   you bought the domain from.
3. Wait for it to go green — usually minutes, occasionally a few hours.
4. Go to **Settings → Environment Variables** and change
   `NEXT_PUBLIC_SITE_URL` to your real domain, with `https://` and **no**
   trailing slash:

   ```
   NEXT_PUBLIC_SITE_URL = https://publishcoffee.com
   ```

5. **Redeploy**: Deployments tab → the three dots on the newest one →
   **Redeploy**. This one matters — links in emails, the sitemap and the
   payment return URLs all read this value.

---

## Step 5b — Hiding the shop until you are ready

Your domain is live the moment you connect it, which means whatever is deployed
is public. If you are still setting up — no photos, placeholder coffees, prices
not final — put a **coming soon** page up first.

In Vercel → Settings → Environment Variables:

```
COMING_SOON = true
```

**Redeploy.** Visitors now see a coming-soon page with your name, a short
description and a place to leave their email. Everything else about the site
keeps working:

- **/admin** still works, so you can add coffees and set prices
- **signing in** still works
- **payments and webhooks** still work, so you can test a real order
- search engines are told not to index anything yet

### Showing someone the real site before it opens

Add a second variable with any hard-to-guess phrase:

```
COMING_SOON_PREVIEW_SECRET = kopi-rahasia-2026
```

Then send anyone this link:

```
https://publishcoffee.com/?preview=kopi-rahasia-2026
```

They see the real shop, and keep seeing it for a month. Everyone else still
sees coming soon. Useful for showing a partner or a photographer before launch.

### Opening

Change `COMING_SOON` to `false` and redeploy. That is the launch.

Collect the emails people left in the meantime from
**Admin → Site settings** — they are the first people to tell.

---

## How to add or change a setting

You will do this many times — for keys, for switching things on and off. It is
the same six clicks every time.

A "setting" here is a labelled box holding a value. The website reads them when
it starts up, which is why nothing changes until you redeploy. Vercel calls
them **Environment Variables**; they are the same thing.

1. Go to **vercel.com** and click your project
2. Click **Settings** along the top
3. Click **Environment Variables** in the left-hand menu
4. Type the name in the **Key** box — exactly as written, capitals and
   underscores included
5. Type the value in the **Value** box
6. Make sure **Production** is ticked, then click **Save**

Then the step everyone forgets:

7. Click **Deployments** along the top, find the newest one, click the **⋯**
   button on its right, and choose **Redeploy**

**Nothing you change here takes effect until you redeploy.** If you have
changed a setting and the site looks exactly the same, this is almost always
why.

### Changing one that already exists

Same page. Hover the row, click the **⋯** at the end, choose **Edit**, change
the value, save. Then redeploy.

### If you make a mistake

Nothing here can break the shop permanently. A wrong value either gets ignored
or makes one feature stop working, and fixing it is editing the box and
redeploying. Keys are free to regenerate. There is no step you cannot undo.

---

## Which key is which

By the end of setup you have keys from four different services, and they all
look like meaningless strings of characters. This is the map.

| Name in Vercel | Comes from | What it does | If it leaks |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Your database's address | Harmless — it is in the website's code anyway |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page | Lets visitors read public things | Harmless — same reason |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page, click "Reveal" | **Full access to everything** | Serious. Reset it in Supabase immediately |
| `XENDIT_SECRET_KEY` | Xendit → Settings → API Keys | Takes payments | Serious. Delete it in Xendit and make a new one |
| `XENDIT_WEBHOOK_TOKEN` | Xendit → Settings → Webhooks | Proves a payment message really came from Xendit | Moderate. Regenerate it |
| `BITESHIP_API_KEY` | Biteship → Integrations → Pengaturan | Asks couriers for prices | Depends which kind — see below |
| `BITESHIP_WEBHOOK_SECRET` | **You invent this one** | Proves a delivery update really came from Biteship | Change it and update the URL in Biteship |
| `COMING_SOON_PREVIEW_SECRET` | **You invent this one** | The pre-launch preview link | Harmless. Change it |

Two of these you make up yourself rather than copy from anywhere — any long
random phrase works.

### Test keys and live keys

Several of these services give you two versions of the same key, and it trips
everyone up because the button is identical:

| | Test / sandbox | Live |
|---|---|---|
| **Biteship** | starts `biteship_test.` | starts `biteship_live.` |
| **Xendit** | starts `xnd_development_` | starts `xnd_production_` |

**The prefix is how you tell them apart.** With Biteship, which one you get
depends on whether the "Testing Mode" toggle was on when you created it — same
button, different toggle.

A test key does nothing real: fake couriers, fake payments, nothing ships and
no money moves. That is what makes it safe to experiment with, and it is what
we use while setting things up. The website checks the prefix, so a live key
used somewhere it should not be gets refused rather than quietly spending your
money.

**Having both is normal.** Make a test key now, a live key later, and swap them
over in Vercel when you are ready to open.

---

## Step 6 — Payments

You have two options. **Do Path A if you possibly can** — it is the only one
that accepts foreign cards and the only one where everything is automatic.

### Path A — Xendit (recommended)

You already have an approved Xendit account; this is about finding the setup
again.

1. Log in at **https://dashboard.xendit.co**.
2. Top right, there is a **Test mode / Live mode** switch. Start in **Test
   mode**.
3. Go to **Settings → API Keys → Generate secret key**.
   - **Name:** `website`
   - **Permissions:** give it **Money-in** write access.
   - Copy the key the moment it appears — Xendit will not show it again.
4. Go to **Settings → Webhooks**. Find **Invoices paid** and set the URL to:

   ```
   https://publishcoffee.com/api/webhooks/xendit
   ```

   (Use your real domain.)
5. On the same page, copy the **Webhook verification token**.
6. In Vercel → Settings → Environment Variables, add:

   ```
   PAYMENT_PROVIDER      = xendit
   XENDIT_SECRET_KEY     = (the secret key from step 3)
   XENDIT_WEBHOOK_TOKEN  = (the token from step 5)
   ```

7. **Redeploy.**
8. **Test it.** Place a real order on your own site. Xendit's test mode gives
   you fake payment details to complete it with. Then check:
   - **Admin → Orders** shows the order as **Paid**
   - the stock on that coffee went down
   - if you were signed in, your points went up

   If it stays "Awaiting payment", the webhook URL is wrong. Check step 4 for
   typos.
9. When the test works, switch Xendit to **Live mode**, generate a **live**
   secret key, set the **live** webhook URL to the same address, and update the
   two values in Vercel. **Redeploy.** Then place one small real order with
   your own money and refund yourself.

### Path B — bank transfer with a unique code (fallback, Indonesia only)

Use this only if Xendit cannot be recovered. Foreign customers will not be able
to pay by card.

Every order gets a unique 3-digit code added to its total — Rp 165.000 becomes
Rp 165.247 — and Moota watches your bank account and tells the website when
that exact amount arrives.

1. Sign up at **https://moota.co** (there is a small monthly fee) and connect
   your bank account.
2. In Moota, add a **webhook** pointing at:

   ```
   https://publishcoffee.com/api/webhooks/moota
   ```

3. Copy Moota's **webhook secret**.
4. In Vercel, add:

   ```
   PAYMENT_PROVIDER                = manual_transfer
   MOOTA_WEBHOOK_SECRET            = (the secret from step 3)
   MANUAL_TRANSFER_BANK_NAME       = BCA
   MANUAL_TRANSFER_ACCOUNT_NUMBER  = 1234567890
   MANUAL_TRANSFER_ACCOUNT_NAME    = PT Aroma Pulau Arunika
   MANUAL_TRANSFER_QRIS_IMAGE_URL  = (optional, see below)
   ```

5. **Redeploy.**

To show your static QRIS code at checkout: open **Admin → Products**, edit any
product, upload the QR image with the photo uploader, copy the address it
gives you, then paste that into `MANUAL_TRANSFER_QRIS_IMAGE_URL` and redeploy.

**What to expect with Path B:** if a customer types the wrong amount, the
payment cannot be matched automatically. It appears in **Admin → Payments**,
where you pick the right order from a list and click Resolve. That does
everything an automatic payment would have.

---

## Step 7 — Check everything works

Walk through this once before you tell anyone the site is open:

- [ ] The homepage loads on your real domain
- [ ] A coffee can be added to the cart and bought
- [ ] The order appears in **Admin → Orders**
- [ ] Paying marks it **Paid** on its own
- [ ] Stock went down by the right amount
- [ ] Points appeared on your account
- [ ] A blog post can be written, saved as a draft, then published
- [ ] The roasting quote form arrives in **Admin → Roasting requests**
- [ ] `https://yourdomain.com/sitemap.xml` lists your pages

---

## If something goes wrong

**The site says "Missing environment variable …"**
That variable is not set in Vercel, or you set it but did not redeploy.
Settings → Environment Variables, then redeploy.

**Orders stay on "Awaiting payment" after a real payment**
The webhook is not reaching the site. Check the URL in Xendit or Moota, exactly
as written above, on your real domain. In Xendit, **Settings → Webhooks** has a
delivery log showing what it tried and what came back.

**I cannot get into /admin**
You are signed in as a customer, not an admin. Repeat Step 4 for your email
address.

**I changed something in the admin but the site looks the same**
Shop and blog pages are cached for a few minutes for speed. Wait, then reload.

**I am worried about running out of Supabase storage**
Open **Admin → Site settings → Images & storage**. It shows exactly how much
of the 1 GB allowance is used and offers to delete images nothing points at
any more. Photos are automatically shrunk when you upload them, so this should
grow slowly.

**I need to undo something**
Orders, posts and products all keep their history. Nothing in the admin
permanently deletes an order. If you delete a product, past orders keep their
own copy of the name and price, so your records stay correct.
