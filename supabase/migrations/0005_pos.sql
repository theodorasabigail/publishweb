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
--
-- Two defences against `create or replace` being unable to change a return
-- type, both needed, for two different databases:
--
--   the drop  -- an existing shop already has this function returning the old
--               `sales_channel` enum. Replacing it in place would be refused,
--               so setup.sql could not upgrade that shop at all.
--   the cast  -- once 0019 has widened the column to text, this body yields
--               text, and re-declaring the narrow type would not match it.
--
-- Casting costs nothing and is right whichever type the column currently is.
-- --------------------------------------------------------------------------
drop function if exists public.sales_summary(timestamptz, timestamptz);

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
    o.channel::text,
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
--
-- Dropped first for the same reason as sales_summary above: 0019 gives it an
-- extra column for orders taken by hand.
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
