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
