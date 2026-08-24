-- ===========================================================================
-- Publish Coffee Roasters -- closing the gaps around manual orders
--
-- 0019 made orders from WhatsApp and Instagram first-class in the admin, but
-- only in the admin. Everything pointing outwards -- the receipt, the tracking
-- email, the shipping report -- still quietly assumed an order came from the
-- website. This file fixes the parts of that which live in the database; the
-- rest is in the application.
--
-- Run this in Supabase -> SQL Editor, after 0021.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- One-time repair: unstick receipts that were claimed but never sent.
--
-- `sendOrderConfirmation` marks an order as "receipt sent" *before* checking
-- whether it should send one, and the check it then failed was a channel test.
-- Every manual order that reached it was therefore stamped as notified without
-- an email ever going out -- and, worse, could never be notified afterwards,
-- because the stamp is what stops a second send.
--
-- Clearing the stamp lets those orders be emailed properly now that the
-- application no longer refuses to. It has to happen exactly once: after this,
-- a manual order's stamp is a real one, and clearing it again on the next
-- paste of setup.sql would send everybody a duplicate receipt. So it is
-- latched on a flag rather than left to run every time.
-- --------------------------------------------------------------------------
alter table public.site_settings
  add column if not exists manual_receipt_claims_repaired boolean not null default false;

do $$
declare
  v_done boolean;
begin
  select coalesce(manual_receipt_claims_repaired, false)
    into v_done from public.site_settings where id = true;

  if coalesce(v_done, false) then
    return;
  end if;

  update public.orders
     set confirmation_email_sent_at = null
   where channel <> 'online'
     and confirmation_email_sent_at is not null;

  update public.site_settings
     set manual_receipt_claims_repaired = true
   where id = true;
end $$;

comment on column public.site_settings.manual_receipt_claims_repaired is
  'Latch for a one-time repair. Manual orders were once stamped as having been emailed a receipt without one being sent; this records that the bad stamps have been cleared, so re-running setup.sql cannot clear real ones and send duplicates.';

-- --------------------------------------------------------------------------
-- Shipping, counted wherever it was charged.
--
-- The report was written when only the website could ship, so it filtered to
-- online orders. A WhatsApp order that charges for postage is shipping revenue
-- like any other, and leaving it out understates both what was charged and
-- what the roastery absorbed.
--
-- Manual orders carry no zone -- the operator agrees a price in the chat
-- rather than reading it off a table -- so they group under a label that says
-- so rather than under "unknown", which would read like a fault.
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
    coalesce(
      o.shipping_zone,
      case when o.channel = 'online' then 'unknown' else 'agreed by hand' end
    ),
    count(*)::bigint,
    coalesce(sum(o.shipping_idr), 0)::bigint,
    coalesce(sum(o.shipping_discount_idr), 0)::bigint
  from public.orders o
  where o.paid_at >= p_from
    and o.paid_at < p_to
    and o.status <> 'cancelled'
    and o.voided_at is null
    -- An order that was collected has no shipping to report on either side.
    and (o.shipping_idr > 0 or o.shipping_discount_idr > 0)
  group by 1
  order by coalesce(sum(o.shipping_discount_idr), 0) desc;
$$;

-- --------------------------------------------------------------------------
-- Find an order.
--
-- Filtering by status and channel only gets you so far; the question actually
-- asked at the counter is "where is Anwar's order", and the answer might be
-- under a reference, a phone number, a handle or a city.
--
-- Matching is by substring rather than by `ilike` with wrapped wildcards, so a
-- `%` or `_` typed into the search box is a character to look for rather than
-- a pattern that matches everything.
-- --------------------------------------------------------------------------
create or replace function public.search_orders(
  p_query text default null,
  p_status text default null,
  p_channel text default null,
  p_voided boolean default false,
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
    -- Voided orders are their own view of the list, never mixed into it.
    (p_voided is not true) = (o.voided_at is null)
    and (p_status is null or p_status = '' or o.status::text = p_status)
    and (p_channel is null or p_channel = '' or o.channel = p_channel)
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

revoke all on function public.shipping_summary(timestamptz, timestamptz) from anon, authenticated;
revoke all on function public.search_orders(text, text, text, boolean, integer) from anon, authenticated;
