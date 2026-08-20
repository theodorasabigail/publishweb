-- ===========================================================================
-- Publish Coffee Roasters -- complete database setup
-- PT Aroma Pulau Arunika
--
-- THIS FILE IS GENERATED. Do not edit it by hand.
-- Edit supabase/migrations/*.sql instead, then run: npm run build:sql
--
-- ---------------------------------------------------------------------------
-- HOW TO USE THIS
--
-- Setting up a brand new Supabase project:
--   Copy this entire file, paste it into Supabase -> SQL Editor, click Run.
--   That is the whole database. You should see "Success. No rows returned."
--
-- Already have the site running:
--   Do NOT use this file. Run only the new numbered files from
--   supabase/migrations/ that you have not run before.
--
-- Running this twice is safe: tables, functions and policies are replaced
-- rather than duplicated, the example content is skipped if it already exists,
-- and your own settings are never overwritten.
--
-- Generated from 13 migrations:
--   0001_init.sql
--   0002_functions_rls.sql
--   0003_seed.sql
--   0004_media_usage.sql
--   0005_pos.sql
--   0006_shipping_subsidy.sql
--   0007_shipping_origin.sql
--   0008_courier_tracking.sql
--   0009_email_notifications.sql
--   0010_free_sizes.sql
--   0011_catalogue.sql
--   0012_coming_soon_text.sql
--   0013_flavour_scale.sql
-- ===========================================================================


-- ###########################################################################
-- ## 0001_init.sql
-- ###########################################################################

-- ===========================================================================
-- Publish Coffee Roasters -- initial schema
-- PT Aroma Pulau Arunika
--
-- Run this in Supabase -> SQL Editor. It is idempotent enough to re-run on a
-- fresh project, but it is meant to be applied once, in order, with 0002.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------
-- Enums
-- --------------------------------------------------------------------------
do $$ begin
  create type loyalty_tier as enum ('bronze', 'silver', 'gold');
exception when duplicate_object then null; end $$;

do $$ begin
  create type variant_size as enum ('100g', '200g', '1kg');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('pending', 'paid', 'roasting', 'shipped', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type roasting_status as enum ('new', 'quoted', 'accepted', 'declined', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type post_status as enum ('draft', 'scheduled', 'published');
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------------------
-- profiles -- extends auth.users
-- --------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  phone text,
  loyalty_points integer not null default 0,
  lifetime_points integer not null default 0,
  tier loyalty_tier not null default 'bronze',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- addresses
-- --------------------------------------------------------------------------
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  province text,
  postal_code text,
  country text not null default 'ID',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists addresses_user_id_idx on public.addresses(user_id);

-- --------------------------------------------------------------------------
-- categories
-- --------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  image_url text,
  show_on_homepage boolean not null default true,
  sort_order integer not null default 0,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- products
-- --------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  origin text,
  process text,
  roast_level text,
  varietal text,
  masl text,
  tasting_notes text,
  category_id uuid references public.categories(id) on delete set null,
  image_url text,
  image_alt text,
  accent_color text not null default '#8c6144',
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  seo_title text,
  seo_description text,
  og_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_active_sort_idx on public.products(is_active, sort_order);

-- --------------------------------------------------------------------------
-- product_variants
-- --------------------------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size variant_size not null,
  price_idr integer not null check (price_idr >= 0),
  stock integer not null default 0 check (stock >= 0),
  weight_grams integer not null default 0,
  is_active boolean not null default true,
  unique (product_id, size)
);
create index if not exists product_variants_product_id_idx on public.product_variants(product_id);

-- --------------------------------------------------------------------------
-- orders
-- --------------------------------------------------------------------------
create sequence if not exists public.order_ref_seq start 148;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  human_ref text not null unique default 'PUB-' || lpad(nextval('public.order_ref_seq')::text, 6, '0'),
  user_id uuid references public.profiles(id) on delete set null,
  guest_email text,
  status order_status not null default 'pending',
  subtotal_idr integer not null default 0,
  shipping_idr integer not null default 0,
  unique_code integer not null default 0,
  total_idr integer not null default 0,
  payment_method text,
  payment_ref text,
  payment_url text,
  payment_expires_at timestamptz,
  shipping_address jsonb,
  shipping_zone text,
  courier_note text,
  tracking_number text,
  customer_note text,
  points_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_total_pending_idx on public.orders(total_idr) where status = 'pending';

-- --------------------------------------------------------------------------
-- order_items
-- --------------------------------------------------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  name_snapshot text not null,
  size_snapshot text not null,
  slug_snapshot text,
  unit_price_idr integer not null,
  quantity integer not null check (quantity > 0)
);
create index if not exists order_items_order_id_idx on public.order_items(order_id);

-- --------------------------------------------------------------------------
-- roasting_requests
-- --------------------------------------------------------------------------
create sequence if not exists public.roasting_ref_seq start 1;

create table if not exists public.roasting_requests (
  id uuid primary key default gen_random_uuid(),
  human_ref text not null unique default 'JR-' || lpad(nextval('public.roasting_ref_seq')::text, 5, '0'),
  user_id uuid references public.profiles(id) on delete set null,
  contact_name text not null,
  contact_phone text not null,
  email text,
  green_bean_origin text not null,
  quantity_kg numeric(10, 2) not null check (quantity_kg > 0),
  desired_roast_level text,
  notes text,
  status roasting_status not null default 'new',
  quoted_price_idr integer,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists roasting_requests_status_idx on public.roasting_requests(status);

-- --------------------------------------------------------------------------
-- blog
-- --------------------------------------------------------------------------
create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  accent_color text not null default '#714c39',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body text,
  cover_image text,
  cover_alt text,
  author_name text not null default 'Publish Coffee Roasters',
  blog_category_id uuid references public.blog_categories(id) on delete set null,
  tags text[] not null default '{}',
  status post_status not null default 'draft',
  is_featured boolean not null default false,
  reading_minutes integer,
  seo_title text,
  seo_description text,
  og_image_url text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists blog_posts_status_published_idx on public.blog_posts(status, published_at desc);
create index if not exists blog_posts_category_idx on public.blog_posts(blog_category_id);
create index if not exists blog_posts_tags_idx on public.blog_posts using gin (tags);

-- --------------------------------------------------------------------------
-- shipping_zones -- flat-rate zones (v1). Swappable for Biteship later.
-- --------------------------------------------------------------------------
create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  country_codes text[] not null default '{}',
  is_domestic boolean not null default false,
  base_rate_idr integer not null default 0,
  -- second tier kicks in above threshold_grams
  threshold_grams integer not null default 1000,
  heavy_rate_idr integer not null default 0,
  free_shipping_over_idr integer,
  delivery_estimate text,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

-- --------------------------------------------------------------------------
-- site_settings -- single row, powers the bounded presentation controls
-- --------------------------------------------------------------------------
create table if not exists public.site_settings (
  id boolean primary key default true check (id),
  hero_image text,
  hero_title text not null default 'Coffee, published.',
  hero_subtitle text,
  hero_cta_label text default 'Shop the roast list',
  hero_cta_href text default '/shop',
  banner_enabled boolean not null default false,
  banner_image text,
  banner_text text,
  banner_link text,
  homepage_category_ids uuid[] not null default '{}',
  featured_post_id uuid references public.blog_posts(id) on delete set null,
  announcement_note text,
  loyalty_rupiah_per_point integer not null default 10000,
  tier_silver_threshold integer not null default 100,
  tier_gold_threshold integer not null default 500,
  whatsapp_number text,
  instagram_url text,
  contact_email text,
  seo_title text not null default 'Publish Coffee Roasters',
  seo_description text,
  og_image_url text,
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (true) on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- payment_events -- raw webhook log + unmatched-payment queue (Path B)
-- --------------------------------------------------------------------------
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text,
  amount_idr integer,
  status text,
  matched_order_id uuid references public.orders(id) on delete set null,
  is_matched boolean not null default false,
  is_resolved boolean not null default false,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists payment_events_unmatched_idx on public.payment_events(is_matched, is_resolved);
-- Non-partial on purpose: the webhook upsert targets ON CONFLICT
-- (provider, external_id), which cannot be inferred from a partial index.
-- Null external_ids stay distinct, so unidentified events are never merged.
create unique index if not exists payment_events_provider_external_idx
  on public.payment_events(provider, external_id);

-- --------------------------------------------------------------------------
-- loyalty_ledger -- every point movement, for auditability
-- --------------------------------------------------------------------------
create table if not exists public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  points integer not null,
  reason text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists loyalty_ledger_user_idx on public.loyalty_ledger(user_id, created_at desc);

-- --------------------------------------------------------------------------
-- newsletter_subscribers
-- --------------------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  created_at timestamptz not null default now()
);


-- ###########################################################################
-- ## 0002_functions_rls.sql
-- ###########################################################################

-- ===========================================================================
-- Publish Coffee Roasters -- triggers, helper functions, Row Level Security
-- Run this AFTER 0001_init.sql.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- updated_at maintenance
-- --------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists blog_posts_touch_updated_at on public.blog_posts;
create trigger blog_posts_touch_updated_at
  before update on public.blog_posts
  for each row execute function public.touch_updated_at();

drop trigger if exists roasting_requests_touch_updated_at on public.roasting_requests;
create trigger roasting_requests_touch_updated_at
  before update on public.roasting_requests
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------------
-- Auto-create a profile row whenever someone signs up
-- --------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------------------
-- Admin check. SECURITY DEFINER so it can read profiles without tripping the
-- policies that call it (which would otherwise recurse).
-- --------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- --------------------------------------------------------------------------
-- Only one default address per user
-- --------------------------------------------------------------------------
create or replace function public.enforce_single_default_address()
returns trigger
language plpgsql
as $$
begin
  if new.is_default then
    update public.addresses
       set is_default = false
     where user_id = new.user_id
       and id <> new.id
       and is_default;
  end if;
  return new;
end;
$$;

drop trigger if exists addresses_single_default on public.addresses;
create trigger addresses_single_default
  after insert or update of is_default on public.addresses
  for each row when (new.is_default) execute function public.enforce_single_default_address();

-- --------------------------------------------------------------------------
-- Loyalty: recompute tier from lifetime points using admin-set thresholds
-- --------------------------------------------------------------------------
create or replace function public.recalculate_tier(p_user_id uuid)
returns loyalty_tier
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lifetime integer;
  v_silver integer;
  v_gold integer;
  v_tier loyalty_tier;
begin
  select lifetime_points into v_lifetime from public.profiles where id = p_user_id;
  if v_lifetime is null then
    return null;
  end if;

  select tier_silver_threshold, tier_gold_threshold
    into v_silver, v_gold
    from public.site_settings where id = true;

  v_tier := case
    when v_lifetime >= coalesce(v_gold, 500) then 'gold'::loyalty_tier
    when v_lifetime >= coalesce(v_silver, 100) then 'silver'::loyalty_tier
    else 'bronze'::loyalty_tier
  end;

  update public.profiles set tier = v_tier where id = p_user_id;
  return v_tier;
end;
$$;

-- --------------------------------------------------------------------------
-- Loyalty: award/adjust points atomically and write the ledger.
-- Positive points add to both balance and lifetime; negative points (spends,
-- corrections) only reduce the balance so tier is never silently demoted.
-- --------------------------------------------------------------------------
create or replace function public.award_loyalty_points(
  p_user_id uuid,
  p_points integer,
  p_reason text,
  p_order_id uuid default null,
  p_created_by uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_user_id is null or p_points = 0 then
    return null;
  end if;

  update public.profiles
     set loyalty_points = greatest(0, loyalty_points + p_points),
         lifetime_points = case when p_points > 0 then lifetime_points + p_points else lifetime_points end
   where id = p_user_id
   returning loyalty_points into v_balance;

  if v_balance is null then
    return null;
  end if;

  insert into public.loyalty_ledger (user_id, order_id, points, reason, created_by)
  values (p_user_id, p_order_id, p_points, p_reason, p_created_by);

  perform public.recalculate_tier(p_user_id);
  return v_balance;
end;
$$;

-- --------------------------------------------------------------------------
-- Mark an order paid. Idempotent: a webhook that fires twice awards points
-- once. This is the single funnel every payment provider goes through.
-- --------------------------------------------------------------------------
create or replace function public.mark_order_paid(
  p_order_id uuid,
  p_payment_ref text default null,
  p_payment_method text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_rate integer;
  v_points integer;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order is null then
    raise exception 'order % not found', p_order_id;
  end if;

  -- Already settled: return as-is without re-awarding points.
  if v_order.paid_at is not null then
    return v_order;
  end if;

  select greatest(1, coalesce(loyalty_rupiah_per_point, 10000))
    into v_rate from public.site_settings where id = true;

  v_points := floor(v_order.total_idr::numeric / v_rate)::integer;

  update public.orders
     set status = 'paid',
         paid_at = now(),
         payment_ref = coalesce(p_payment_ref, payment_ref),
         payment_method = coalesce(p_payment_method, payment_method),
         points_awarded = case when v_order.user_id is null then 0 else v_points end
   where id = p_order_id
   returning * into v_order;

  -- Decrement stock once, at the moment money is confirmed.
  update public.product_variants v
     set stock = greatest(0, v.stock - i.qty)
    from (
      select variant_id, sum(quantity)::integer as qty
        from public.order_items
       where order_id = p_order_id and variant_id is not null
       group by variant_id
    ) i
   where v.id = i.variant_id;

  if v_order.user_id is not null and v_points > 0 then
    perform public.award_loyalty_points(
      v_order.user_id, v_points, 'Order ' || v_order.human_ref, p_order_id, null
    );
  end if;

  return v_order;
end;
$$;

-- ===========================================================================
-- Row Level Security
--
-- Shape of the rules:
--   * Anonymous/public traffic can read published storefront content only.
--   * A signed-in user can read and write only their own rows.
--   * Admins (profiles.is_admin) get full access through the dashboard.
--   * Order/payment writes happen server-side with the service-role key,
--     which bypasses RLS entirely -- so no client-side insert policy exists
--     for orders, order_items, payment_events or loyalty_ledger.
-- ===========================================================================

alter table public.profiles              enable row level security;
alter table public.addresses             enable row level security;
alter table public.categories            enable row level security;
alter table public.products              enable row level security;
alter table public.product_variants      enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.roasting_requests     enable row level security;
alter table public.blog_categories       enable row level security;
alter table public.blog_posts            enable row level security;
alter table public.shipping_zones        enable row level security;
alter table public.site_settings         enable row level security;
alter table public.payment_events        enable row level security;
alter table public.loyalty_ledger        enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- ---- profiles -------------------------------------------------------------
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles: admin write" on public.profiles;
create policy "profiles: admin write" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- addresses ------------------------------------------------------------
drop policy if exists "addresses: own" on public.addresses;
create policy "addresses: own" on public.addresses
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ---- catalogue (public read of active rows, admin write) ------------------
drop policy if exists "categories: public read" on public.categories;
create policy "categories: public read" on public.categories for select using (true);

drop policy if exists "categories: admin write" on public.categories;
create policy "categories: admin write" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "products: public read active" on public.products;
create policy "products: public read active" on public.products
  for select using (is_active or public.is_admin());

drop policy if exists "products: admin write" on public.products;
create policy "products: admin write" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "variants: public read" on public.product_variants;
create policy "variants: public read" on public.product_variants
  for select using (
    public.is_admin() or exists (
      select 1 from public.products p where p.id = product_id and p.is_active
    )
  );

drop policy if exists "variants: admin write" on public.product_variants;
create policy "variants: admin write" on public.product_variants
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- orders ---------------------------------------------------------------
drop policy if exists "orders: read own" on public.orders;
create policy "orders: read own" on public.orders
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "orders: admin write" on public.orders;
create policy "orders: admin write" on public.orders
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "order_items: read own" on public.order_items;
create policy "order_items: read own" on public.order_items
  for select using (
    public.is_admin() or exists (
      select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "order_items: admin write" on public.order_items;
create policy "order_items: admin write" on public.order_items
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- roasting requests ----------------------------------------------------
drop policy if exists "roasting: read own" on public.roasting_requests;
create policy "roasting: read own" on public.roasting_requests
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "roasting: admin write" on public.roasting_requests;
create policy "roasting: admin write" on public.roasting_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- blog -----------------------------------------------------------------
drop policy if exists "blog_categories: public read" on public.blog_categories;
create policy "blog_categories: public read" on public.blog_categories for select using (true);

drop policy if exists "blog_categories: admin write" on public.blog_categories;
create policy "blog_categories: admin write" on public.blog_categories
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "blog_posts: public read published" on public.blog_posts;
create policy "blog_posts: public read published" on public.blog_posts
  for select using (
    public.is_admin()
    or (status = 'published' and (published_at is null or published_at <= now()))
  );

drop policy if exists "blog_posts: admin write" on public.blog_posts;
create policy "blog_posts: admin write" on public.blog_posts
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- shipping + settings --------------------------------------------------
drop policy if exists "shipping_zones: public read" on public.shipping_zones;
create policy "shipping_zones: public read" on public.shipping_zones for select using (true);

drop policy if exists "shipping_zones: admin write" on public.shipping_zones;
create policy "shipping_zones: admin write" on public.shipping_zones
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "site_settings: public read" on public.site_settings;
create policy "site_settings: public read" on public.site_settings for select using (true);

drop policy if exists "site_settings: admin write" on public.site_settings;
create policy "site_settings: admin write" on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- payments + loyalty ledger (admin-visible only) -----------------------
drop policy if exists "payment_events: admin only" on public.payment_events;
create policy "payment_events: admin only" on public.payment_events
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "loyalty_ledger: read own" on public.loyalty_ledger;
create policy "loyalty_ledger: read own" on public.loyalty_ledger
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "loyalty_ledger: admin write" on public.loyalty_ledger;
create policy "loyalty_ledger: admin write" on public.loyalty_ledger
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- newsletter -----------------------------------------------------------
drop policy if exists "newsletter: anyone subscribe" on public.newsletter_subscribers;
create policy "newsletter: anyone subscribe" on public.newsletter_subscribers
  for insert with check (true);

drop policy if exists "newsletter: admin read" on public.newsletter_subscribers;
create policy "newsletter: admin read" on public.newsletter_subscribers
  for all using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- Storage: one public bucket for product + blog imagery.
-- Reads are public (images on the storefront); writes are admin-only.
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media: public read" on storage.objects;
create policy "media: public read" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "media: admin write" on storage.objects;
create policy "media: admin write" on storage.objects
  for all using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());


-- ###########################################################################
-- ## 0003_seed.sql
-- ###########################################################################

-- ===========================================================================
-- Publish Coffee Roasters -- starter data
--
-- Safe to run on a fresh project. Everything here is editable later from the
-- Admin Dashboard; none of it needs to be changed in SQL.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Shipping zones (flat rate, v1). Rates are padded on purpose -- see docs.
-- --------------------------------------------------------------------------
insert into public.shipping_zones
  (code, name, country_codes, is_domestic, base_rate_idr, threshold_grams, heavy_rate_idr, free_shipping_over_idr, delivery_estimate, sort_order)
values
  ('id-jawa',    'Indonesia — Jawa',        array['ID'], true,   18000, 1000,  30000, 500000, '1–3 hari kerja',  1),
  ('id-luar',    'Indonesia — luar Jawa',   array['ID'], true,   32000, 1000,  55000, 750000, '2–6 hari kerja',  2),
  ('sea',        'Southeast Asia',          array['SG','MY','TH','VN','PH','BN','KH','LA','MM'], false, 180000, 1000, 300000, null, '5–10 business days', 3),
  ('apac',       'Asia-Pacific',            array['AU','NZ','JP','KR','TW','HK','CN','IN'],      false, 260000, 1000, 420000, null, '7–14 business days', 4),
  ('europe',     'Europe & UK',             array['GB','IE','DE','FR','NL','BE','ES','IT','PT','SE','NO','DK','FI','PL','CH','AT','CZ'], false, 340000, 1000, 540000, null, '8–16 business days', 5),
  ('north-america', 'North America',        array['US','CA','MX'], false, 360000, 1000, 570000, null, '8–16 business days', 6),
  ('rest',       'Rest of world',           array[]::text[],       false, 420000, 1000, 660000, null, '10–21 business days', 7)
on conflict (code) do nothing;

-- --------------------------------------------------------------------------
-- Product categories
-- --------------------------------------------------------------------------
insert into public.categories (slug, name, description, show_on_homepage, sort_order)
values
  ('single-origin', 'Single Origin', 'One farm, one lot, one story. Rotating micro-lots from across the archipelago.', true, 1),
  ('house-blend', 'House Blends', 'Built for milk, built for repeatability. The bags we drink every morning.', true, 2),
  ('filter', 'Filter Roast', 'Lighter, brighter, developed for pourover and immersion.', true, 3),
  ('espresso', 'Espresso Roast', 'Sweet, dense, forgiving under pressure.', true, 4)
on conflict (slug) do nothing;

-- --------------------------------------------------------------------------
-- Products + variants
-- --------------------------------------------------------------------------
with c as (select slug, id from public.categories)
insert into public.products
  (slug, name, description, origin, process, roast_level, varietal, masl, tasting_notes,
   category_id, accent_color, is_featured, sort_order)
values
  ('gayo-arunika', 'Gayo Arunika',
   'Our anchor lot from the Gayo highlands. Wet-hulled in the traditional Sumatran way, then roasted a touch past first crack to keep the body heavy and the finish clean.',
   'Aceh Tengah, Sumatra', 'Wet Hulled', 'Medium', 'Ateng, Timtim', '1400–1600',
   'Dark chocolate, cedar, brown sugar',
   (select id from c where slug = 'single-origin'), '#486b73', true, 1),

  ('kintamani-lestari', 'Kintamani Lestari',
   'Grown alongside citrus trees on the slopes of Mount Batur, which is exactly what it tastes like. Fully washed and dried on raised beds.',
   'Kintamani, Bali', 'Fully Washed', 'Light-Medium', 'Kartika, S795', '1200–1500',
   'Mandarin, jasmine, golden syrup',
   (select id from c where slug = 'filter'), '#dab0b0', true, 2),

  ('toraja-sapan', 'Toraja Sapan',
   'A high-grown Sulawesi lot with the structure to hold up in a long brew. Quiet acidity, long sweet finish.',
   'Tana Toraja, Sulawesi', 'Semi Washed', 'Medium', 'S795, Typica', '1500–1750',
   'Baking spice, dried fig, dark cocoa',
   (select id from c where slug = 'single-origin'), '#486b73', false, 3),

  ('terbit-blend', 'Terbit Blend',
   'Our everyday espresso. Sumatra for the body, Bali for the lift. Designed to taste like itself through a flat white.',
   'Blend — Sumatra & Bali', 'Blend', 'Medium-Dark', 'Various', '1200–1600',
   'Milk chocolate, toasted almond, red plum',
   (select id from c where slug = 'espresso'), '#638c97', true, 4),

  ('malam-decaf', 'Malam Decaf',
   'Sugarcane-process decaf from Java. For the second pot, the late shift, and everyone who wants the ritual without the rest of it.',
   'Java Barat', 'Sugarcane EA Decaf', 'Medium', 'Lini S', '1300–1500',
   'Cocoa nib, roasted hazelnut, raisin',
   (select id from c where slug = 'house-blend'), '#a7a4b5', false, 5)
on conflict (slug) do nothing;

insert into public.product_variants (product_id, size, price_idr, stock, weight_grams)
select p.id, v.size, v.price, v.stock, v.grams
from public.products p
cross join (values
  ('100g'::variant_size, 68000,  40, 130),
  ('200g'::variant_size, 125000, 30, 240),
  ('1kg'::variant_size,  560000, 12, 1100)
) as v(size, price, stock, grams)
where p.slug in ('gayo-arunika','kintamani-lestari','toraja-sapan','terbit-blend','malam-decaf')
on conflict (product_id, size) do nothing;

-- --------------------------------------------------------------------------
-- Blog
-- --------------------------------------------------------------------------
insert into public.blog_categories (slug, name, description, accent_color, sort_order)
values
  ('roasting-notes', 'Roasting Notes', 'What came off the drum this week, and why it tastes the way it does.', '#486b73', 1),
  ('origin', 'Origin', 'Farms, washing stations, and the people we buy from.', '#638c97', 2),
  ('brewing', 'Brewing', 'Recipes, ratios, and arguments about water.', '#dab0b0', 3),
  ('shop-journal', 'Shop Journal', 'Everything else that happens in a roastery.', '#486b73', 4)
on conflict (slug) do nothing;

insert into public.blog_posts
  (slug, title, excerpt, body, author_name, blog_category_id, tags, status, is_featured, published_at)
values
  ('why-we-wet-hull',
   'Why we still wet-hull',
   'Wet-hulling is the process most likely to get a Sumatran coffee disqualified from a cupping table. We keep buying it anyway.',
   E'Wet-hulling — *giling basah* — is the process most likely to get a Sumatran coffee thrown out of a specialty cupping table. The parchment comes off at a much higher moisture content than anywhere else in the world, the beans go a strange jade colour, and the resulting cup rarely does the bright, clean, fruit-forward thing that scores well.\n\nWe keep buying it anyway.\n\n## What actually happens\n\nIn a washed process, coffee dries inside its parchment down to about 11% moisture before hulling. In Aceh, the parchment is stripped at somewhere between 30 and 50%. The bean is soft. It deforms. It picks up the character of everything around it while it finishes drying in the open.\n\nThat is the whole argument against it, and it is a fair one. It is also the entire reason the coffee tastes like cedar and dark chocolate and old bookshelves instead of like every other washed coffee on the shelf.\n\n## The roasting problem\n\nA wet-hulled lot arrives less dense and less uniform than a washed one. Push it the way you would push a Kenyan and you get scorched tips and a hollow middle. We take the charge temperature down, stretch the Maillard phase, and drop about forty seconds past first crack.\n\nThe goal is not to make it taste clean. The goal is to make it taste like the best possible version of what it already is.',
   'Ebi', (select id from public.blog_categories where slug = 'roasting-notes'),
   array['sumatra','process','roasting'], 'published', true, now() - interval '6 days'),

  ('water-is-the-recipe',
   'Water is the recipe',
   'You can buy a better grinder or you can fix your water. One of those is Rp 8.000.',
   E'Every brewing guide starts with the grind. We would like to make a case for starting one step earlier.\n\nCoffee is about 98.5% water by weight. The mineral content of that water decides how much of the coffee actually dissolves, and in what order. Jakarta tap water, run through a basic filter jug, is usually too hard — it pulls the bitter compounds forward and flattens everything above them.\n\n## A starting point\n\nAim for roughly 70–100 ppm total dissolved solids, with the hardness sitting a little below the alkalinity. In practice, in Indonesia, that means:\n\n- Start with a low-mineral bottled water as your base\n- Cut it with a small amount of harder mineral water until the cup opens up\n- Keep the ratio written down, because you will forget it\n\nThat is the whole trick. Same beans, same grinder, same hands — a different cup.',
   'Ebi', (select id from public.blog_categories where slug = 'brewing'),
   array['brewing','water','pourover'], 'published', false, now() - interval '3 days'),

  ('kintamani-harvest-2026',
   'Notes from the Kintamani harvest',
   'Three days on the slopes of Batur with the growers behind the Lestari lot.',
   E'The road up to Kintamani is a series of switchbacks through citrus groves, which turns out to be relevant.\n\nCoffee here is almost never planted alone. It grows under and beside tangerine trees, and the growers we buy from will tell you plainly that the fruit trees are the reliable income and the coffee is the one that pays attention.\n\n## The washing station\n\nThe Lestari lot is fully washed and dried on raised beds, which is not the regional default. It takes longer and it costs more, and it is the reason the cup is as clean as it is.\n\nWe committed to the same lot for a third year running. Consistency is worth more to us than chasing a novel micro-lot every season.',
   'Ebi', (select id from public.blog_categories where slug = 'origin'),
   array['bali','origin','harvest'], 'published', false, now() - interval '1 day')
on conflict (slug) do nothing;

-- --------------------------------------------------------------------------
-- Homepage presentation defaults
-- --------------------------------------------------------------------------
update public.site_settings
   set hero_title = 'Coffee, published.',
       hero_subtitle = 'A small roastery in Indonesia. Rotating single origins, blends we actually drink, and a custom roasting service for your own green beans.',
       homepage_category_ids = array(
         select id from public.categories where show_on_homepage order by sort_order
       ),
       featured_post_id = (select id from public.blog_posts where slug = 'why-we-wet-hull'),
       seo_description = 'Small-batch Indonesian coffee roasters. Single origin, blends, and custom roasting from PT Aroma Pulau Arunika.',
       contact_email = 'halo@publishcoffee.com'
 -- Only seed these on a fresh project. Without this guard, re-running the
 -- setup file would reset a hero the operator had already rewritten.
 where id = true
   and hero_subtitle is null;


-- ###########################################################################
-- ## 0004_media_usage.sql
-- ###########################################################################

-- ===========================================================================
-- Publish Coffee Roasters -- media storage reporting
--
-- The free Supabase plan allows 1 GB of file storage and 5 GB of egress a
-- month. Two things quietly eat that: oversized originals (handled in the
-- browser, before upload) and files that stay in the bucket after the row
-- pointing at them has moved on. These functions make the second one visible
-- and fixable from the admin dashboard.
--
-- Run this in Supabase -> SQL Editor, after 0003.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Every image URL currently referenced by a row somewhere.
-- --------------------------------------------------------------------------
create or replace view public.referenced_media as
  select image_url as url from public.products where image_url is not null
  union
  select og_image_url from public.products where og_image_url is not null
  union
  select image_url from public.categories where image_url is not null
  union
  select cover_image from public.blog_posts where cover_image is not null
  union
  select og_image_url from public.blog_posts where og_image_url is not null
  union
  select hero_image from public.site_settings where hero_image is not null
  union
  select banner_image from public.site_settings where banner_image is not null
  union
  select og_image_url from public.site_settings where og_image_url is not null;

-- --------------------------------------------------------------------------
-- How much of the storage allowance is in use.
-- --------------------------------------------------------------------------
create or replace function public.media_storage_usage()
returns table (object_count bigint, total_bytes bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::bigint,
    coalesce(sum(coalesce((metadata ->> 'size')::bigint, 0)), 0)::bigint
  from storage.objects
  where bucket_id = 'media';
$$;

-- --------------------------------------------------------------------------
-- Files in the bucket that nothing points at any more -- usually a product
-- photo that was replaced, since a replacement uploads to a new path.
--
-- Anything uploaded in the last 24 hours is excluded on purpose: a file sits
-- in the bucket from the moment it uploads until the form around it is saved,
-- and that gap must never look like garbage.
-- --------------------------------------------------------------------------
create or replace function public.unused_media()
returns table (name text, size_bytes bigint, uploaded_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.name,
    coalesce((o.metadata ->> 'size')::bigint, 0)::bigint,
    o.created_at
  from storage.objects o
  where o.bucket_id = 'media'
    and o.created_at < now() - interval '24 hours'
    -- position() rather than LIKE: object names are not escaped, and a stray
    -- underscore or percent in a filename would otherwise match too broadly.
    and not exists (
      select 1 from public.referenced_media r
      where position(o.name in r.url) > 0
    )
  order by o.created_at;
$$;

-- These read across every table and bypass RLS, so only the server-side
-- service role may call them. The admin dashboard already runs as that role;
-- nothing in the browser can reach them.
revoke all on public.referenced_media from anon, authenticated;
revoke all on function public.media_storage_usage() from anon, authenticated;
revoke all on function public.unused_media() from anon, authenticated;


-- ###########################################################################
-- ## 0005_pos.sql
-- ###########################################################################

-- ===========================================================================
-- Publish Coffee Roasters -- counter sales (POS)
--
-- The same coffee is sold online and over the counter, and both should draw
-- down the same stock and land in the same books. Rather than model a counter
-- sale as a new thing, it reuses `orders` with a channel marker: no shipping,
-- settled the moment it is rung up.
--
-- Run this in Supabase -> SQL Editor, after 0004.
-- ===========================================================================

do $$ begin
  create type sales_channel as enum ('online', 'pos');
exception when duplicate_object then null; end $$;

create sequence if not exists public.pos_ref_seq start 1;

alter table public.orders
  add column if not exists channel sales_channel not null default 'online',
  -- What the customer handed over, for cash. Change is total minus this.
  add column if not exists cash_received_idr integer,
  -- Who rang it up, so a shop with two people behind the counter can tell.
  add column if not exists staff_id uuid references public.profiles(id) on delete set null;

create index if not exists orders_channel_created_idx
  on public.orders(channel, created_at desc);

-- Reporting reads "everything that actually took money, that day", so the
-- partial index matches that shape.
create index if not exists orders_paid_at_idx
  on public.orders(paid_at desc) where paid_at is not null;

-- --------------------------------------------------------------------------
-- Ring up a counter sale.
--
-- One call, one transaction: prices come from the database (never from the
-- till screen), stock is locked and checked before anything is written, and
-- settlement goes through the same `mark_order_paid` every online payment
-- uses -- so stock, loyalty points and the books cannot diverge between the
-- two channels.
--
-- p_items: [{"variant_id": "<uuid>", "quantity": 2}, ...]
-- --------------------------------------------------------------------------
create or replace function public.record_pos_sale(
  p_items jsonb,
  p_payment_method text,
  p_cash_received integer default null,
  p_user_id uuid default null,
  p_staff_id uuid default null,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_order_id uuid;
  v_subtotal integer := 0;
  v_item jsonb;
  v_variant record;
  v_quantity integer;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'A sale needs at least one item.';
  end if;

  if p_payment_method not in ('cash', 'qris', 'card', 'transfer') then
    raise exception 'Unknown payment method %', p_payment_method;
  end if;

  -- Pass one: lock every variant and confirm stock before writing anything,
  -- so a sale can never half-commit and leave stock wrong.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Every line needs a quantity of at least 1.';
    end if;

    select v.id, v.price_idr, v.stock, v.size, v.is_active,
           p.id as product_id, p.name as product_name, p.slug as product_slug
      into v_variant
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.id = (v_item ->> 'variant_id')::uuid
     for update of v;

    if v_variant.id is null then
      raise exception 'That coffee is no longer on the list.';
    end if;
    if not v_variant.is_active then
      raise exception '% (%) is not currently for sale.',
        v_variant.product_name, v_variant.size;
    end if;
    if v_variant.stock < v_quantity then
      raise exception 'Only % of % (%) left in stock.',
        v_variant.stock, v_variant.product_name, v_variant.size;
    end if;

    v_subtotal := v_subtotal + (v_variant.price_idr * v_quantity);
  end loop;

  if p_payment_method = 'cash'
     and p_cash_received is not null
     and p_cash_received < v_subtotal then
    raise exception 'Cash received is less than the total.';
  end if;

  insert into public.orders (
    human_ref, channel, user_id, status,
    subtotal_idr, shipping_idr, unique_code, total_idr,
    payment_method, cash_received_idr, staff_id, customer_note
  )
  values (
    'POS-' || lpad(nextval('public.pos_ref_seq')::text, 5, '0'),
    'pos', p_user_id, 'pending',
    v_subtotal, 0, 0, v_subtotal,
    p_payment_method,
    case when p_payment_method = 'cash' then p_cash_received else null end,
    p_staff_id, p_note
  )
  returning id into v_order_id;

  -- Pass two: write the lines, snapshotting name, size and price as the
  -- online path does, so a later price change never rewrites history.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;

    insert into public.order_items (
      order_id, product_id, variant_id,
      name_snapshot, size_snapshot, slug_snapshot,
      unit_price_idr, quantity
    )
    select v_order_id, p.id, v.id, p.name, v.size::text, p.slug,
           v.price_idr, v_quantity
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.id = (v_item ->> 'variant_id')::uuid;
  end loop;

  -- Same settlement path as every online payment: decrements stock, awards
  -- loyalty points if a customer was attached, exactly once.
  perform public.mark_order_paid(v_order_id, null, p_payment_method);

  -- Nothing to roast or ship -- the customer is holding it.
  update public.orders
     set status = 'completed'
   where id = v_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- --------------------------------------------------------------------------
-- Daily takings, split the way a shop actually counts up: by channel, and by
-- how the money arrived, so the cash drawer can be reconciled against it.
-- --------------------------------------------------------------------------
create or replace function public.sales_summary(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  channel sales_channel,
  payment_method text,
  order_count bigint,
  gross_idr bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.channel,
    coalesce(o.payment_method, 'unknown'),
    count(*)::bigint,
    coalesce(sum(o.total_idr), 0)::bigint
  from public.orders o
  where o.paid_at >= p_from
    and o.paid_at < p_to
    and o.status <> 'cancelled'
  group by o.channel, coalesce(o.payment_method, 'unknown')
  order by o.channel, coalesce(o.payment_method, 'unknown');
$$;

-- --------------------------------------------------------------------------
-- What sold, over a period, across both channels. Answers "what should I
-- roast next" rather than "what did I take".
-- --------------------------------------------------------------------------
create or replace function public.product_sales_report(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  product_name text,
  size text,
  units_sold bigint,
  gross_idr bigint,
  online_units bigint,
  pos_units bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.name_snapshot,
    i.size_snapshot,
    sum(i.quantity)::bigint,
    sum(i.quantity * i.unit_price_idr)::bigint,
    -- coalesce: a product that only sold in one channel must report 0 for
    -- the other, not a blank.
    coalesce(sum(i.quantity) filter (where o.channel = 'online'), 0)::bigint,
    coalesce(sum(i.quantity) filter (where o.channel = 'pos'), 0)::bigint
  from public.order_items i
  join public.orders o on o.id = i.order_id
  where o.paid_at >= p_from
    and o.paid_at < p_to
    and o.status <> 'cancelled'
  group by i.name_snapshot, i.size_snapshot
  order by sum(i.quantity) desc;
$$;

-- These read across all orders and bypass RLS, so only the server-side
-- service role may call them. The admin dashboard already runs as that role.
revoke all on function public.record_pos_sale(jsonb, text, integer, uuid, uuid, text) from anon, authenticated;
revoke all on function public.sales_summary(timestamptz, timestamptz) from anon, authenticated;
revoke all on function public.product_sales_report(timestamptz, timestamptz) from anon, authenticated;


-- ###########################################################################
-- ## 0006_shipping_subsidy.sql
-- ###########################################################################

-- ===========================================================================
-- Publish Coffee Roasters -- partial shipping subsidies
--
-- Zones could already give shipping away entirely above a spend threshold.
-- This adds the middle step most shops actually want first: knock a fixed
-- amount off shipping above a lower threshold, then go free higher up.
--
--   spend Rp 300.000  ->  Rp 20.000 off shipping
--   spend Rp 500.000  ->  shipping free
--
-- Run this in Supabase -> SQL Editor, after 0005.
-- ===========================================================================

alter table public.shipping_zones
  -- Spend at or above this to get the subsidy. Null disables it.
  add column if not exists subsidy_over_idr integer,
  -- Flat rupiah taken off the shipping rate. Never more than the rate itself,
  -- so shipping can reach zero but never becomes a discount on the coffee.
  add column if not exists subsidy_idr integer not null default 0;

alter table public.orders
  -- What the customer was charged is already in shipping_idr. This is what the
  -- roastery absorbed, kept separately so giveaway can be reported on rather
  -- than inferred from a rate card that may since have changed.
  add column if not exists shipping_discount_idr integer not null default 0;

-- A subsidy threshold below which nothing happens is a mistake worth catching
-- at write time rather than discovering at checkout.
do $$ begin
  alter table public.shipping_zones
    add constraint shipping_zones_subsidy_sane
    check (
      subsidy_idr >= 0
      and (subsidy_over_idr is null or subsidy_over_idr >= 0)
      -- If both tiers are set, the free threshold must sit above the subsidy
      -- one, otherwise the subsidy tier is unreachable.
      and (
        free_shipping_over_idr is null
        or subsidy_over_idr is null
        or free_shipping_over_idr > subsidy_over_idr
      )
    );
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------------------
-- What shipping actually cost the business over a period: charged to
-- customers versus absorbed. Answers "is free shipping worth it".
-- --------------------------------------------------------------------------
create or replace function public.shipping_summary(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  shipping_zone text,
  order_count bigint,
  charged_idr bigint,
  absorbed_idr bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(o.shipping_zone, 'unknown'),
    count(*)::bigint,
    coalesce(sum(o.shipping_idr), 0)::bigint,
    coalesce(sum(o.shipping_discount_idr), 0)::bigint
  from public.orders o
  where o.paid_at >= p_from
    and o.paid_at < p_to
    and o.status <> 'cancelled'
    and o.channel = 'online'
  group by coalesce(o.shipping_zone, 'unknown')
  order by coalesce(sum(o.shipping_discount_idr), 0) desc;
$$;

revoke all on function public.shipping_summary(timestamptz, timestamptz) from anon, authenticated;


-- ###########################################################################
-- ## 0007_shipping_origin.sql
-- ###########################################################################

-- ===========================================================================
-- Publish Coffee Roasters -- where parcels ship from
--
-- Flat-rate zones never needed this: the rate was the same wherever the
-- roastery was. Any live-rate courier API does, because a rate is a function
-- of origin as well as destination.
--
-- It lives in site_settings so the operator can correct it in the admin after
-- a move, rather than it being a hard-coded constant nobody remembers.
--
-- Run this in Supabase -> SQL Editor, after 0006.
-- ===========================================================================

alter table public.site_settings
  add column if not exists origin_contact_name text,
  add column if not exists origin_phone text,
  add column if not exists origin_address text,
  add column if not exists origin_city text,
  add column if not exists origin_province text,
  add column if not exists origin_postal_code text,
  -- Couriers and aggregators identify pickup points differently: some want a
  -- postal code, some their own area id, some coordinates. Kept as free text
  -- so a provider can use whatever it needs without another migration.
  add column if not exists origin_area_code text,
  add column if not exists origin_note text;

comment on column public.site_settings.origin_area_code is
  'Provider-specific pickup area identifier, if the courier API needs one.';


-- ###########################################################################
-- ## 0008_courier_tracking.sql
-- ###########################################################################

-- ===========================================================================
-- Publish Coffee Roasters -- courier tracking and webhook events
--
-- Somewhere to put what a courier tells us about a shipment, so tracking
-- reaches the customer without the operator copying numbers by hand, and so a
-- courier charging more than we quoted is visible rather than quietly eating
-- margin.
--
-- Run this in Supabase -> SQL Editor, after 0007.
-- ===========================================================================

alter table public.orders
  -- The courier's own identifiers. courier_order_id is what webhooks arrive
  -- keyed on, so it is the lookup path.
  add column if not exists courier_order_id text,
  add column if not exists courier_tracking_id text,
  add column if not exists courier_waybill_id text,
  add column if not exists courier_company text,
  add column if not exists courier_type text,
  add column if not exists courier_status text,
  add column if not exists courier_driver_name text,
  add column if not exists courier_driver_phone text,
  -- What the courier actually charged. Can differ from what the customer paid
  -- when real weight differs from quoted weight -- Biteship fires order.price
  -- for exactly this. Kept separate from shipping_idr so the customer's side
  -- of the transaction is never rewritten after the fact.
  add column if not exists courier_charged_idr integer;

create index if not exists orders_courier_order_id_idx
  on public.orders(courier_order_id) where courier_order_id is not null;

-- --------------------------------------------------------------------------
-- Raw courier webhook log.
--
-- Every event is written here before anything is acted on, so a mis-parsed or
-- unexpected payload can be inspected rather than guessed at. Also the audit
-- trail for a price that changed after the customer paid.
-- --------------------------------------------------------------------------
create table if not exists public.courier_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'biteship',
  event text not null,
  courier_order_id text,
  order_id uuid references public.orders(id) on delete set null,
  status text,
  payload jsonb,
  -- False when the event could not be tied to one of our orders, so it shows
  -- up for a human instead of vanishing.
  is_matched boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists courier_events_order_idx on public.courier_events(order_id, created_at desc);
create index if not exists courier_events_unmatched_idx
  on public.courier_events(is_matched, created_at desc) where not is_matched;

alter table public.courier_events enable row level security;

drop policy if exists "courier_events: admin only" on public.courier_events;
create policy "courier_events: admin only" on public.courier_events
  for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- How much of a courier overcharge is worth being told about.
--
-- The policy is absorb-and-alert: the customer is never chased for a few
-- thousand rupiah, but a systematically wrong parcel weight should surface
-- rather than quietly eat margin.
-- --------------------------------------------------------------------------
alter table public.site_settings
  add column if not exists courier_variance_alert_idr integer not null default 10000;

-- --------------------------------------------------------------------------
-- Orders where the courier charged materially more than the customer paid.
-- --------------------------------------------------------------------------
create or replace function public.courier_price_variances(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  order_id uuid,
  human_ref text,
  shipping_charged_idr integer,
  courier_charged_idr integer,
  variance_idr integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id,
    o.human_ref,
    o.shipping_idr,
    o.courier_charged_idr,
    (o.courier_charged_idr - o.shipping_idr)::integer,
    o.created_at
  from public.orders o
  cross join lateral (
    select coalesce(courier_variance_alert_idr, 10000) as threshold
    from public.site_settings where id = true
  ) s
  where o.courier_charged_idr is not null
    and o.created_at >= p_from
    and o.created_at < p_to
    and (o.courier_charged_idr - o.shipping_idr) >= s.threshold
  order by (o.courier_charged_idr - o.shipping_idr) desc;
$$;

revoke all on function public.courier_price_variances(timestamptz, timestamptz) from anon, authenticated;


-- ###########################################################################
-- ## 0009_email_notifications.sql
-- ###########################################################################

-- ===========================================================================
-- Publish Coffee Roasters -- transactional email bookkeeping
--
-- Two markers on orders so an email is sent exactly once.
--
-- Payment webhooks retry: Xendit and Moota both redeliver until they get a
-- 200, and mark_order_paid is idempotent precisely so that is safe. Sending
-- email is not idempotent -- a redelivery would put a second receipt in the
-- customer's inbox. These columns are claimed with a conditional update, so
-- the first delivery wins and every later one sends nothing.
--
-- Run this in Supabase -> SQL Editor, after 0008.
-- ===========================================================================

alter table public.orders
  add column if not exists confirmation_email_sent_at timestamptz,
  -- Stores the tracking number that was emailed, not just a timestamp. Saving
  -- the fulfilment form again must not re-notify, but correcting a tracking
  -- number that was typed wrong should -- the customer is holding a number
  -- that does not work.
  add column if not exists shipped_email_tracking text;

comment on column public.orders.confirmation_email_sent_at is
  'Set when the paid-order receipt was sent. Claimed atomically so a redelivered payment webhook cannot send twice.';

comment on column public.orders.shipped_email_tracking is
  'The tracking number the customer was last emailed. A different value means a correction worth re-sending.';


-- ###########################################################################
-- ## 0010_free_sizes.sql
-- ###########################################################################

-- ===========================================================================
-- Publish Coffee Roasters -- sizes the operator controls
--
-- `size` was an enum of exactly '100g', '200g' and '1kg', which meant adding a
-- 250g bag or a 12oz sample was a code change and a deployment. For a roastery
-- that is the wrong place to put that decision -- pack sizes change with the
-- lot, the season, and what the wholesale customer asks for.
--
-- So it becomes free text, and sorting moves onto weight_grams, which the
-- table already carries and which shipping already prices from. Sorting by a
-- real weight is also more correct than the old hard-coded list ever was: it
-- puts 250g between 200g and 1kg without anybody maintaining an order.
--
-- Existing rows are untouched -- '100g' as an enum value and '100g' as text
-- are the same three characters -- so nothing needs re-entering.
--
-- Run this in Supabase -> SQL Editor, after 0009.
-- ===========================================================================

alter table public.product_variants
  alter column size type text using size::text;

-- The old enum still backs nothing once the column is text. Dropped so a
-- future reader does not mistake it for the source of truth. Guarded, because
-- re-running a migration must never be the thing that breaks a database.
drop type if exists variant_size;

-- Shipping already reads weight_grams, but it defaulted to 0, and a 0 g
-- variant silently falls back to a 250 g assumption when a parcel is priced.
-- That was survivable with three fixed sizes whose weights were filled in by
-- the form; with sizes the operator invents, an unfilled weight is a real
-- possibility and a wrong shipping quote is a real cost.
alter table public.product_variants
  add constraint product_variants_weight_positive
  check (weight_grams > 0) not valid;

-- `not valid` above means existing rows are left alone rather than blocking
-- the migration; this fixes them, and then the constraint holds for everything
-- new. The estimate is the pack size plus packaging, matching what the admin
-- form has been defaulting to.
update public.product_variants
set weight_grams = case
  when size ilike '%1kg%' or size ilike '%1000g%' then 1100
  when size ilike '%500g%' then 550
  when size ilike '%250g%' then 290
  when size ilike '%200g%' then 240
  when size ilike '%100g%' then 130
  else 250
end
where weight_grams <= 0;

alter table public.product_variants
  validate constraint product_variants_weight_positive;

comment on column public.product_variants.size is
  'Free text, shown to the customer as-is. Ordering comes from weight_grams.';


-- ###########################################################################
-- ## 0011_catalogue.sql
-- ###########################################################################

-- ===========================================================================
-- Publish Coffee Roasters -- the real roast list
--
-- Ebi's actual catalogue, from the price sheet: 17 coffees across five
-- origins, in whatever pack sizes each one is offered in. Only possible after
-- 0010 made `size` free text -- this list uses 15g, 45g, 75g, 150g, 300g and
-- 1kg, none of which the old enum allowed.
--
-- The regions on the price sheet -- Jawa Timur, Jawa Barat, Africa, Sumatra,
-- Latin America -- are recorded as each product's ORIGIN, not as categories.
-- They describe where a coffee is from, which is a fact about the coffee;
-- categories are how the shop chooses to group things for a visitor, and that
-- is a separate decision the operator should make later in the admin.
--
-- Every insert is `on conflict (slug) do nothing`, so running this twice adds
-- nothing and, more importantly, never overwrites a price edited in the admin
-- after the fact. To genuinely reset one, delete it in the admin first.
--
-- Prices are exactly as supplied. Stock is 0 -- nothing is sellable until it
-- is counted in, which is the honest starting state for a roastery.
--
-- Run this in Supabase -> SQL Editor, after 0010.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Retire the demo coffees.
--
-- Deactivated rather than deleted: any of them may already be attached to a
-- test order, and an order must never lose the product it was for. They vanish
-- from the shop and stay visible in the admin, where they can be deleted by
-- hand once the operator is sure.
-- --------------------------------------------------------------------------
update public.products
set is_active = false, is_featured = false
where slug in (
  'gayo-arunika', 'kintamani-lestari', 'toraja-sapan', 'terbit-blend', 'malam-decaf'
);

-- --------------------------------------------------------------------------
-- The coffees.
-- --------------------------------------------------------------------------
insert into public.products
  (slug, name, origin, process, varietal, accent_color, is_active, is_featured, sort_order)
values
  -- Jawa Timur
  ('mami-estate-waved-natural-komasti', 'Mami Estate Waved Natural Komasti',
   'Jawa Timur', 'Waved Natural', 'Komasti', '#486b73', true, true, 1),
  ('mami-estate-natural-komasti', 'Mami Estate Natural Komasti',
   'Jawa Timur', 'Natural', 'Komasti', '#486b73', true, false, 2),

  -- Jawa Barat
  ('palintang-washed-java-ateng', 'Palintang Washed Java Ateng',
   'Jawa Barat', 'Washed', 'Java Ateng', '#638c97', true, false, 3),
  ('genteng-sumedang-anaerobic-natural', 'Genteng Sumedang Anaerobic Natural Mixed Varieties',
   'Jawa Barat', 'Anaerobic Natural', 'Mixed Varieties', '#638c97', true, false, 4),
  ('mt-patuha-red-honey', 'Mt. Patuha Red Honey Mixed Varieties',
   'Jawa Barat', 'Red Honey', 'Mixed Varieties', '#638c97', true, true, 5),
  ('patuha-natural-typica', 'Patuha Natural Typica',
   'Jawa Barat', 'Natural', 'Typica', '#638c97', true, false, 6),
  ('kamojang-anaerobic-washed', 'Kamojang Anaerobic Washed',
   'Jawa Barat', 'Anaerobic Washed', null, '#638c97', true, false, 7),
  ('kertasari-natural-java', 'Kertasari Natural Java',
   'Jawa Barat', 'Natural', 'Java', '#638c97', true, false, 8),
  ('sukawangi-sumedang-natural-excelsa', 'Sukawangi Sumedang Natural Excelsa',
   'Jawa Barat', 'Natural', 'Excelsa', '#638c97', true, false, 9),
  ('puntang-extended-natural', 'Puntang Extended Natural Mixed Varieties',
   'Jawa Barat', 'Extended Natural', 'Mixed Varieties', '#638c97', true, false, 10),

  -- Africa
  ('ethiopia-bensa-daye-mountain-decaf', 'Ethiopia Bensa Daye Mountain Decaf Washed',
   'Africa', 'Washed Decaf', null, '#a7a4b5', true, false, 11),

  -- Sumatra
  ('aceh-bener-meriah-anaerobic-natural-gayo-1', 'Aceh Bener Meriah Anaerobic Natural Gayo 1',
   'Sumatra', 'Anaerobic Natural', 'Gayo 1', '#dab0b0', true, true, 12),

  -- Latin America
  ('panama-totumas-typica-washed', 'Panama Totumas Typica Washed',
   'Latin America', 'Washed', 'Typica', '#ee8a7a', true, false, 13),
  ('ecuador-sidra-anaerobic-washed', 'Ecuador Sidra Anaerobic Washed',
   'Latin America', 'Anaerobic Washed', 'Sidra', '#ee8a7a', true, false, 14),
  ('ecuador-sidra-anaerobic-honey-co2', 'Ecuador Sidra Anaerobic Honey CO2',
   'Latin America', 'Anaerobic Honey CO2', 'Sidra', '#ee8a7a', true, false, 15),
  ('hacienda-la-papaya-b7-anaerobic-120hr', 'Hacienda La Papaya B7 Anaerobic 120HR',
   'Latin America', 'Anaerobic 120HR', 'B7', '#ee8a7a', true, false, 16)
on conflict (slug) do nothing;

-- --------------------------------------------------------------------------
-- Pack sizes and prices.
--
-- Only the sizes each coffee is actually offered in: the price sheet has gaps,
-- and a gap means "we do not sell that size", not "price it at zero".
--
-- Shipping weight is the pack plus its packaging -- proportionally heavier on
-- the small sample sizes, where a 15 g bag is mostly bag.
-- --------------------------------------------------------------------------
insert into public.product_variants (product_id, size, price_idr, stock, weight_grams, is_active)
select p.id, v.size, v.price_idr, 0, v.weight_grams, true
from (values
  -- Jawa Timur
  ('mami-estate-waved-natural-komasti', '75gr',  105000, 110),
  ('mami-estate-waved-natural-komasti', '150gr', 185000, 190),
  ('mami-estate-waved-natural-komasti', '300gr', 350000, 350),
  ('mami-estate-natural-komasti',       '75gr',  105000, 110),
  ('mami-estate-natural-komasti',       '150gr', 185000, 190),
  ('mami-estate-natural-komasti',       '300gr', 350000, 350),

  -- Jawa Barat
  ('palintang-washed-java-ateng',        '75gr',   75000, 110),
  ('palintang-washed-java-ateng',        '150gr', 140000, 190),
  ('palintang-washed-java-ateng',        '300gr', 250000, 350),
  ('genteng-sumedang-anaerobic-natural', '75gr',   82500, 110),
  ('genteng-sumedang-anaerobic-natural', '150gr', 150000, 190),
  ('genteng-sumedang-anaerobic-natural', '300gr', 285000, 350),
  ('mt-patuha-red-honey',                '75gr',   88000, 110),
  ('mt-patuha-red-honey',                '150gr', 165000, 190),
  ('mt-patuha-red-honey',                '300gr', 304000, 350),
  ('patuha-natural-typica',              '75gr',   90750, 110),
  ('patuha-natural-typica',              '150gr', 175000, 190),
  ('patuha-natural-typica',              '300gr', 332500, 350),
  ('kamojang-anaerobic-washed',          '75gr',   95000, 110),
  ('kamojang-anaerobic-washed',          '150gr', 160000, 190),
  ('kamojang-anaerobic-washed',          '300gr', 300000, 350),
  ('kertasari-natural-java',             '75gr',   96250, 110),
  ('kertasari-natural-java',             '150gr', 180000, 190),
  ('kertasari-natural-java',             '300gr', 342000, 350),
  ('sukawangi-sumedang-natural-excelsa', '75gr',  104500, 110),
  ('sukawangi-sumedang-natural-excelsa', '150gr', 175000, 190),
  ('sukawangi-sumedang-natural-excelsa', '300gr', 345000, 350),
  ('puntang-extended-natural',           '75gr',  108000, 110),
  ('puntang-extended-natural',           '150gr', 180000, 190),
  ('puntang-extended-natural',           '300gr', 322000, 350),

  -- Africa
  ('ethiopia-bensa-daye-mountain-decaf', '15gr',   82500,  45),
  ('ethiopia-bensa-daye-mountain-decaf', '45gr',  190000,  80),
  ('ethiopia-bensa-daye-mountain-decaf', '75gr',  295000, 110),

  -- Sumatra
  ('aceh-bener-meriah-anaerobic-natural-gayo-1', '75gr',   82500,  110),
  ('aceh-bener-meriah-anaerobic-natural-gayo-1', '150gr', 150000,  190),
  ('aceh-bener-meriah-anaerobic-natural-gayo-1', '300gr', 285000,  350),
  ('aceh-bener-meriah-anaerobic-natural-gayo-1', '1KG',   375000, 1100),

  -- Latin America
  ('panama-totumas-typica-washed',          '15gr', 140000,  45),
  ('ecuador-sidra-anaerobic-washed',        '15gr',  75000,  45),
  ('ecuador-sidra-anaerobic-washed',        '45gr', 170000,  80),
  ('ecuador-sidra-anaerobic-washed',        '75gr', 250000, 110),
  ('ecuador-sidra-anaerobic-honey-co2',     '15gr',  80000,  45),
  ('ecuador-sidra-anaerobic-honey-co2',     '45gr', 180000,  80),
  ('ecuador-sidra-anaerobic-honey-co2',     '75gr', 250000, 110),
  ('hacienda-la-papaya-b7-anaerobic-120hr', '15gr',  88000,  45),
  ('hacienda-la-papaya-b7-anaerobic-120hr', '45gr', 200000,  80),
  ('hacienda-la-papaya-b7-anaerobic-120hr', '75gr', 315000, 110)
) as v(product_slug, size, price_idr, weight_grams)
join public.products p on p.slug = v.product_slug
on conflict (product_id, size) do nothing;


-- ###########################################################################
-- ## 0012_coming_soon_text.sql
-- ###########################################################################

-- ===========================================================================
-- Publish Coffee Roasters -- editable coming-soon page
--
-- The pre-launch page had its wording hard-coded, which made the one page the
-- whole internet can currently see the only page the operator could not
-- change. Backwards.
--
-- Nullable with no defaults on purpose: null means "use what the page ships
-- with", so an operator who never opens the panel sees no change, and clearing
-- a field puts the original wording back rather than leaving a blank page.
--
-- Run this in Supabase -> SQL Editor, after 0011.
-- ===========================================================================

alter table public.site_settings
  add column if not exists coming_soon_eyebrow text,
  add column if not exists coming_soon_title text,
  add column if not exists coming_soon_body text,
  add column if not exists coming_soon_note text,
  add column if not exists coming_soon_contact_line text;

comment on column public.site_settings.coming_soon_title is
  'Pre-launch page wording. Null falls back to the built-in copy, so clearing a field restores it rather than emptying the page.';


-- ###########################################################################
-- ## 0013_flavour_scale.sql
-- ###########################################################################

-- ===========================================================================
-- Publish Coffee Roasters -- the flavour colour scale
--
-- Publish's own six-colour system, the one printed on the bags. 1-5 run from
-- the cleanest, most delicate cups to the biggest; 6 is the heavily processed
-- lots, which sit off that line rather than further along it.
--
-- Only the level is stored. The colours and labels live in src/lib/flavour.ts,
-- because they are printed on packaging and a shop that could drift out of
-- step with the bag would be worse than no scale at all.
--
-- Run this in Supabase -> SQL Editor, after 0012.
-- ===========================================================================

alter table public.products
  add column if not exists flavour_level smallint
  check (flavour_level is null or flavour_level between 1 and 6);

comment on column public.products.flavour_level is
  'Publish flavour scale, 1 (delicate) to 5 (bold), 6 = heavily processed. Null = not yet assigned. Colours and labels are in src/lib/flavour.ts.';

create index if not exists products_flavour_level_idx
  on public.products(flavour_level) where flavour_level is not null;

-- --------------------------------------------------------------------------
-- Starting assignments for the current lineup.
--
-- Read off the packaging artwork. Where a coffee was legible there its colour
-- is used directly; where it was not, the level is inferred from the process
-- in its name, which is the same signal the artwork encodes. Those inferences
-- are marked, and all of it is editable in the admin -- this is a starting
-- point so nothing launches uncoloured, not a decision.
--
-- Only fills empty values, so re-running never overwrites a correction.
-- --------------------------------------------------------------------------
update public.products p
set flavour_level = v.level
from (values
  -- Read directly from the artwork
  ('mami-estate-waved-natural-komasti',            1),  -- white
  ('ethiopia-bensa-daye-mountain-decaf',           1),  -- white
  ('ecuador-sidra-anaerobic-washed',               1),  -- white
  ('palintang-washed-java-ateng',                  2),  -- pale yellow
  ('kamojang-anaerobic-washed',                    2),  -- pale yellow
  ('mt-patuha-red-honey',                          4),  -- orange
  ('sukawangi-sumedang-natural-excelsa',           4),  -- orange
  ('genteng-sumedang-anaerobic-natural',           5),  -- deep orange
  ('patuha-natural-typica',                        5),  -- deep orange
  ('kertasari-natural-java',                       5),  -- deep orange
  ('aceh-bener-meriah-anaerobic-natural-gayo-1',   6),  -- purple
  ('ecuador-sidra-anaerobic-honey-co2',            6),  -- purple
  ('hacienda-la-papaya-b7-anaerobic-120hr',        6),  -- purple

  -- Inferred from the process, not seen on the artwork. Worth a second look.
  ('mami-estate-natural-komasti',                  5),  -- natural
  ('puntang-extended-natural',                     5),  -- extended natural
  ('panama-totumas-typica-washed',                 1)   -- washed
) as v(slug, level)
where p.slug = v.slug
  and p.flavour_level is null;

