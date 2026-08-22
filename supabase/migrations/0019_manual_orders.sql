-- ===========================================================================
-- Publish Coffee Roasters -- manual orders and reserved stock
--
-- Coffee gets sold in more places than the website and the counter. An order
-- arrives over WhatsApp, or as a DM on Instagram, and until now it lived in a
-- chat thread and a notebook: not in the stock count, not in the takings, not
-- in the customer's points.
--
-- Two changes make those orders first-class.
--
-- 1. `channel` stops being a two-value enum and becomes text with a check, the
--    same move `variant_size` made in 0010. Adding "tokopedia" next year is
--    then one line here, not an enum migration and a deployment.
--
-- 2. Stock can be *reserved*. A counter sale takes the coffee off the shelf
--    immediately, so stock and payment happen together and nothing needed
--    reserving. A WhatsApp order does not: it is agreed now and paid later,
--    and between those two moments the website would happily sell the same
--    last bag to somebody else. So a manual order holds its stock from the
--    moment it is written, and that hold is released when it is paid (the
--    stock genuinely leaves) or cancelled (it goes back on the shelf).
--
-- Run this in Supabase -> SQL Editor, after 0018.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Channels
--
-- `sales_summary` returns the channel, so it depends on the type and has to
-- go before the column can change. It is recreated at the bottom of this file.
-- --------------------------------------------------------------------------
drop function if exists public.sales_summary(timestamptz, timestamptz);

alter table public.orders
  alter column channel drop default;

alter table public.orders
  alter column channel type text using channel::text;

alter table public.orders
  alter column channel set default 'online',
  alter column channel set not null;

drop type if exists sales_channel;

-- Kept as a check rather than an enum so a new channel is a one-line change.
-- Written idempotently: re-running setup.sql must not fail on the constraint
-- already being there, and must still widen it if this file has since grown.
alter table public.orders drop constraint if exists orders_channel_check;
alter table public.orders add constraint orders_channel_check
  check (channel in ('online', 'pos', 'whatsapp', 'instagram', 'marketplace', 'other'));

-- Which WhatsApp number, which Instagram handle, which marketplace order id.
-- Enough to find the conversation again when the customer asks where it is.
alter table public.orders
  add column if not exists channel_reference text;

comment on column public.orders.channel is
  'Where the sale came from. Anything other than ''online'' was entered by hand.';
comment on column public.orders.channel_reference is
  'The thread this order came from -- a phone number, an @handle, a marketplace reference.';

-- Manual orders are looked up by channel far more often than online ones, and
-- almost always newest-first.
create index if not exists orders_channel_created_idx
  on public.orders(channel, created_at desc);

-- --------------------------------------------------------------------------
-- Reserved stock
--
-- `available` is generated rather than computed at each call site, so there is
-- exactly one definition of "can I sell this" and every query -- the shop, the
-- till, the checkout API -- reads the same number.
-- --------------------------------------------------------------------------
alter table public.product_variants
  add column if not exists reserved integer not null default 0 check (reserved >= 0);

alter table public.product_variants
  add column if not exists available integer
  generated always as (case when stock > reserved then stock - reserved else 0 end) stored;

comment on column public.product_variants.reserved is
  'Held by manual orders that are agreed but not yet paid. Comes off `available`, not off `stock` -- the coffee is still on the shelf, it is just spoken for.';
comment on column public.product_variants.available is
  'What may still be sold: stock minus what unpaid manual orders are holding.';

-- Orders that are holding stock. A timestamp rather than a flag so an
-- abandoned reservation can be found and swept up by age.
alter table public.orders
  add column if not exists stock_reserved_at timestamptz;

create index if not exists orders_stock_reserved_idx
  on public.orders(stock_reserved_at) where stock_reserved_at is not null;

comment on column public.orders.stock_reserved_at is
  'Set while this order holds stock against `product_variants.reserved`. Cleared when it is paid or cancelled -- exactly once, so a hold can never be released twice.';

-- --------------------------------------------------------------------------
-- Release an order's hold on stock.
--
-- Idempotent by construction: the release is *claimed* by clearing
-- stock_reserved_at under the order's row lock, and a second call finds
-- nothing to claim and does nothing. That matters because both the payment
-- path and the cancellation path call it, and an order can travel both.
-- --------------------------------------------------------------------------
create or replace function public.release_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_held boolean;
begin
  select stock_reserved_at is not null
    into v_held
    from public.orders
   where id = p_order_id
     for update;

  if not coalesce(v_held, false) then
    return;
  end if;

  update public.product_variants v
     set reserved = greatest(0, v.reserved - i.qty)
    from (
      select variant_id, sum(quantity)::integer as qty
        from public.order_items
       where order_id = p_order_id and variant_id is not null
       group by variant_id
    ) i
   where v.id = i.variant_id;

  update public.orders
     set stock_reserved_at = null
   where id = p_order_id;
end;
$$;

-- --------------------------------------------------------------------------
-- Settlement, now aware of reservations.
--
-- Replaces the definition in 0002. The only change is the release: when a
-- reserved order is paid, the coffee stops being "spoken for" and starts being
-- "gone", and both sides of that have to move together or `available` drifts.
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
   where id = p_order_id;

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

  -- The hold, if this order had one, has now become a real decrement. Release
  -- it in the same transaction so `available` never double-counts the sale.
  perform public.release_order_stock(p_order_id);

  if v_order.user_id is not null and v_points > 0 then
    perform public.award_loyalty_points(
      v_order.user_id, v_points, 'Order ' || v_order.human_ref, p_order_id, null
    );
  end if;

  select * into v_order from public.orders where id = p_order_id;
  return v_order;
end;
$$;

-- --------------------------------------------------------------------------
-- Cancel an order and put its stock back.
--
-- Only the hold is returned, never the stock itself: once an order has been
-- paid the coffee has left the building, and cancelling it afterwards is a
-- refund, which is a decision for a human and a fresh stock count.
-- --------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  perform public.release_order_stock(p_order_id);

  update public.orders
     set status = 'cancelled'
   where id = p_order_id
  returning * into v_order;

  if v_order is null then
    raise exception 'order % not found', p_order_id;
  end if;

  return v_order;
end;
$$;

-- --------------------------------------------------------------------------
-- Sweep up holds nobody is going to honour.
--
-- A reservation is a promise to a customer, so nothing expires it
-- automatically -- but an order agreed over WhatsApp three weeks ago and never
-- paid is holding coffee that could be sold. This returns what it released, so
-- the operator can see what came back rather than wonder.
-- --------------------------------------------------------------------------
create or replace function public.release_stale_reservations(
  p_older_than interval default interval '14 days'
)
returns table (order_id uuid, human_ref text, released_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
begin
  -- Aliased, because this function's OUT parameters are called `order_id` and
  -- `human_ref` too, and an unqualified reference to either inside the query
  -- is ambiguous between the two.
  for v_order in
    select o.id as id, o.human_ref as ref
      from public.orders o
     where o.stock_reserved_at is not null
       and o.status = 'pending'
       and o.stock_reserved_at < now() - p_older_than
  loop
    perform public.release_order_stock(v_order.id);
    order_id := v_order.id;
    human_ref := v_order.ref;
    released_at := now();
    return next;
  end loop;
end;
$$;

-- --------------------------------------------------------------------------
-- Write an order that was agreed somewhere other than the website.
--
-- This is the general case, and `record_pos_sale` is now one setting of it: a
-- counter sale is a manual order that is paid the instant it is written and
-- carries nothing to ship. Doing it this way means a WhatsApp order and a
-- counter sale cannot drift apart -- same price lookup, same stock check, same
-- settlement, same books.
--
-- What varies is only the two things that actually differ:
--
--   p_mark_paid          false when the money has not arrived yet, which is
--                        the normal case for a chat order. The order is then
--                        `pending` and holds its stock until it is settled.
--   p_shipping_address   null when the customer is collecting. Present means
--                        there is something to pack, so the order stops at
--                        `paid` rather than running through to `completed`.
--
-- p_items: [{"variant_id": "<uuid>", "quantity": 2}, ...]
-- --------------------------------------------------------------------------
create sequence if not exists public.manual_ref_seq start 1;

create or replace function public.record_manual_order(
  p_items jsonb,
  p_channel text default 'pos',
  p_payment_method text default null,
  p_mark_paid boolean default true,
  p_cash_received integer default null,
  p_user_id uuid default null,
  p_staff_id uuid default null,
  p_note text default null,
  p_channel_reference text default null,
  p_shipping_address jsonb default null,
  p_shipping_idr integer default 0
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
  v_shipping integer := greatest(0, coalesce(p_shipping_idr, 0));
  v_total integer;
  v_item jsonb;
  v_variant record;
  v_quantity integer;
  v_ships boolean := p_shipping_address is not null;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'An order needs at least one item.';
  end if;

  if p_channel not in ('pos', 'whatsapp', 'instagram', 'marketplace', 'other') then
    raise exception 'Unknown channel %. Orders from the website are written by the checkout, not here.', p_channel;
  end if;

  -- An unpaid order may name the method it is *expected* to be paid by, or
  -- leave it open. A paid one must say how the money arrived.
  if p_mark_paid and coalesce(p_payment_method, '') not in ('cash', 'qris', 'card', 'transfer') then
    raise exception 'Unknown payment method %', coalesce(p_payment_method, '(none)');
  end if;
  if not p_mark_paid
     and p_payment_method is not null
     and p_payment_method not in ('cash', 'qris', 'card', 'transfer') then
    raise exception 'Unknown payment method %', p_payment_method;
  end if;

  -- Pass one: lock every variant and confirm availability before writing
  -- anything, so an order can never half-commit and leave stock wrong.
  --
  -- The check is against `available`, not `stock`: coffee another unpaid
  -- order is already holding is not ours to promise a second time.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Every line needs a quantity of at least 1.';
    end if;

    select v.id, v.price_idr, v.available, v.size, v.is_active,
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
    if v_variant.available < v_quantity then
      raise exception 'Only % of % (%) available -- the rest is either sold or held by another order.',
        v_variant.available, v_variant.product_name, v_variant.size;
    end if;

    v_subtotal := v_subtotal + (v_variant.price_idr * v_quantity);
  end loop;

  v_total := v_subtotal + v_shipping;

  if p_mark_paid
     and p_payment_method = 'cash'
     and p_cash_received is not null
     and p_cash_received < v_total then
    raise exception 'Cash received is less than the total.';
  end if;

  insert into public.orders (
    human_ref, channel, channel_reference, user_id, status,
    subtotal_idr, shipping_idr, unique_code, total_idr,
    payment_method, cash_received_idr, staff_id, customer_note,
    shipping_address, stock_reserved_at
  )
  values (
    case
      when p_channel = 'pos'
        then 'POS-' || lpad(nextval('public.pos_ref_seq')::text, 5, '0')
      else 'MAN-' || lpad(nextval('public.manual_ref_seq')::text, 5, '0')
    end,
    p_channel, p_channel_reference, p_user_id, 'pending',
    v_subtotal, v_shipping, 0, v_total,
    p_payment_method,
    case when p_mark_paid and p_payment_method = 'cash' then p_cash_received else null end,
    p_staff_id, p_note,
    p_shipping_address, now()
  )
  returning id into v_order_id;

  -- Pass two: write the lines, snapshotting name, size and price as the online
  -- path does, so a later price change never rewrites history.
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

  -- Hold the stock. Written for every order, including one that is about to be
  -- paid on the next line: the hold and its release are one code path, so
  -- there is no second way for `reserved` to be wrong.
  update public.product_variants v
     set reserved = v.reserved + i.qty
    from (
      select variant_id, sum(quantity)::integer as qty
        from public.order_items
       where order_id = v_order_id and variant_id is not null
       group by variant_id
    ) i
   where v.id = i.variant_id;

  if p_mark_paid then
    -- Same settlement path as every online payment: decrements stock, releases
    -- the hold, awards loyalty points if a customer was attached, exactly once.
    perform public.mark_order_paid(v_order_id, null, p_payment_method);

    -- Nothing to pack means the customer is already holding it.
    if not v_ships then
      update public.orders set status = 'completed' where id = v_order_id;
    end if;
  end if;

  select * into v_order from public.orders where id = v_order_id;
  return v_order;
end;
$$;

-- --------------------------------------------------------------------------
-- Counter sales, unchanged from the caller's point of view.
--
-- Kept as its own name because the till calls it and because "ring up a sale"
-- deserves to read as one thing, but it no longer has its own implementation
-- to keep in step.
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
begin
  return public.record_manual_order(
    p_items         => p_items,
    p_channel       => 'pos',
    p_payment_method => p_payment_method,
    p_mark_paid     => true,
    p_cash_received => p_cash_received,
    p_user_id       => p_user_id,
    p_staff_id      => p_staff_id,
    p_note          => p_note
  );
end;
$$;

-- --------------------------------------------------------------------------
-- Daily takings, split the way a shop actually counts up. Recreated here
-- because `channel` is text now rather than an enum.
-- --------------------------------------------------------------------------
create or replace function public.sales_summary(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  channel text,
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
-- What sold, across every channel. Recreated for the same reason: it counts
-- online against everything else, and "everything else" is now a longer list.
--
-- Dropped rather than replaced because it gains a column, and Postgres will
-- not let `create or replace` change a function's return type.
-- --------------------------------------------------------------------------
drop function if exists public.product_sales_report(timestamptz, timestamptz);

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
  pos_units bigint,
  manual_units bigint
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
    -- coalesce: a product that only sold in one channel must report 0 for the
    -- others, not a blank.
    coalesce(sum(i.quantity) filter (where o.channel = 'online'), 0)::bigint,
    coalesce(sum(i.quantity) filter (where o.channel = 'pos'), 0)::bigint,
    coalesce(sum(i.quantity) filter (where o.channel not in ('online', 'pos')), 0)::bigint
  from public.order_items i
  join public.orders o on o.id = i.order_id
  where o.paid_at >= p_from
    and o.paid_at < p_to
    and o.status <> 'cancelled'
  group by i.name_snapshot, i.size_snapshot
  order by sum(i.quantity) desc;
$$;

-- These read across all orders and bypass RLS, so only the server-side service
-- role may call them. The admin dashboard already runs as that role.
revoke all on function public.record_manual_order(jsonb, text, text, boolean, integer, uuid, uuid, text, text, jsonb, integer) from anon, authenticated;
revoke all on function public.record_pos_sale(jsonb, text, integer, uuid, uuid, text) from anon, authenticated;
revoke all on function public.release_order_stock(uuid) from anon, authenticated;
revoke all on function public.cancel_order(uuid) from anon, authenticated;
revoke all on function public.release_stale_reservations(interval) from anon, authenticated;
revoke all on function public.sales_summary(timestamptz, timestamptz) from anon, authenticated;
revoke all on function public.product_sales_report(timestamptz, timestamptz) from anon, authenticated;
