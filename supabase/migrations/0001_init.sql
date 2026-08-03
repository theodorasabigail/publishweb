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
create table if not exists public.roasting_requests (
  id uuid primary key default gen_random_uuid(),
  human_ref text not null unique default 'JR-' || lpad(nextval('public.order_ref_seq')::text, 6, '0'),
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
create unique index if not exists payment_events_provider_external_idx
  on public.payment_events(provider, external_id) where external_id is not null;

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
