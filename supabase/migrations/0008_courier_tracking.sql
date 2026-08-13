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
