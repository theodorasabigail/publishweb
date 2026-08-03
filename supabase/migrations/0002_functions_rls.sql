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
