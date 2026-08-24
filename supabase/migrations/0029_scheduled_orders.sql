-- ===========================================================================
-- Publish Coffee Roasters -- orders scheduled for a future ship date
--
-- Corporate customers place orders weeks ahead: "post it on the 15th, ready
-- for our event on the 20th". Until now those had to be tracked in a chat, or
-- entered on the day, or entered now and hoped nobody shipped them early.
--
-- One extra column, `ship_after`. An order carrying one is scheduled: it is
-- recorded now, it holds its coffee like any other manual order, and it is
-- kept out of the "ready to pack" list until the date rolls around.
--
-- The stock hold is the reason this is safe. Whoever plans the roast can see
-- the demand -- the coffee shows as reserved in Products -- rather than being
-- surprised on the ship date by a promise they never knew about.
--
-- Run this in Supabase -> SQL Editor, after 0028.
-- ===========================================================================

alter table public.orders
  add column if not exists ship_after date;

comment on column public.orders.ship_after is
  'Do not ship before this date. An order carrying one is a scheduled order (a "PO"); everything else about it is the same as any other order.';

-- The one query worth an index: today's ready-to-pack list. Orders with no
-- scheduled date are always ready, so the predicate matches those too.
create index if not exists orders_ready_to_pack_idx
  on public.orders(paid_at, ship_after)
  where paid_at is not null
    and shipped_at is null
    and voided_at is null;

-- --------------------------------------------------------------------------
-- Search, extended.
--
-- Replaces the definition in 0022. One extra argument: `p_scheduled`, which
-- narrows the list to orders whose ship date is still in the future. A
-- non-scheduled listing hides scheduled ones so the daily list is not full of
-- orders nobody should be looking at yet.
-- --------------------------------------------------------------------------
drop function if exists public.search_orders(text, text, text, boolean, integer);

create or replace function public.search_orders(
  p_query text default null,
  p_status text default null,
  p_channel text default null,
  p_voided boolean default false,
  p_scheduled boolean default false,
  p_limit integer default 200
)
returns setof public.orders
language sql
stable
security definer
set search_path = public
as $$
  select o.*
  from public.orders o
  where
    (p_voided is not true) = (o.voided_at is null)
    and (p_status is null or p_status = '' or o.status::text = p_status)
    and (p_channel is null or p_channel = '' or o.channel = p_channel)
    and (
      case
        when p_scheduled then o.ship_after > current_date
        -- The everyday list hides scheduled orders. Someone actively looking
        -- for them uses the Scheduled chip, which flips this.
        else o.ship_after is null or o.ship_after <= current_date
      end
    )
    and (
      p_query is null or btrim(p_query) = ''
      or position(lower(btrim(p_query)) in lower(o.human_ref)) > 0
      or position(lower(btrim(p_query)) in lower(coalesce(o.channel_reference, ''))) > 0
      or position(lower(btrim(p_query)) in lower(coalesce(o.guest_email, ''))) > 0
      or position(lower(btrim(p_query)) in lower(coalesce(o.tracking_number, ''))) > 0
      or position(lower(btrim(p_query)) in lower(coalesce(o.customer_note, ''))) > 0
      or position(lower(btrim(p_query)) in lower(coalesce(o.shipping_address ->> 'recipient_name', ''))) > 0
      or position(lower(btrim(p_query)) in lower(coalesce(o.shipping_address ->> 'phone', ''))) > 0
      or position(lower(btrim(p_query)) in lower(coalesce(o.shipping_address ->> 'city', ''))) > 0
    )
  order by o.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;

revoke all on function public.search_orders(text, text, text, boolean, boolean, integer) from anon, authenticated;
