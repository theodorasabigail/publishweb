-- ===========================================================================
-- Publish Coffee Roasters -- unlink fulfilment from payment (and add invoice)
--
-- The status enum was a mixed bag: `pending` and `roasting` and `shipped` are
-- fulfilment states (what the shop is physically doing), but `paid` is a
-- payment state that happened to sit in the same list. That worked while
-- every order took the same neat path -- receive, get paid, roast, ship --
-- and it broke every time a real one did not: paid before packed, packed
-- before paid, invoiced after payment, invoiced weeks before payment.
--
-- Three independent axes now:
--
--   Fulfilment:  pending -> roasting -> packing -> shipped -> delivered
--   Payment:     paid_at (unpaid or paid), driven by its own action
--   Invoice:     invoiced_at (not invoiced or invoiced), driven by its own action
--
-- `paid` leaves the fulfilment dropdown. Anything at status='paid' today gets
-- remapped: a counter sale to `delivered` (the customer walked away with it),
-- everything else to `pending` (payment is on paid_at, and the fulfilment
-- state reverts to "we have not started yet"). paid_at is unchanged, so no
-- payment history is lost. The enum keeps `paid` and `completed` as inert
-- historical values because Postgres cannot drop enum members.
--
-- `packing` and `delivered` are new. Packing is the step between roasting the
-- coffee and putting the parcel in the post -- weighing, bagging, labelling.
-- Delivered is the terminal state for anything that has physically reached
-- the customer, whether that is a counter sale (immediate) or a shipped order
-- the operator has confirmed arrived.
--
-- Run this in Supabase -> SQL Editor, after 0036.
-- ===========================================================================

-- Enum values --------------------------------------------------------------
-- ALTER TYPE ADD VALUE IF NOT EXISTS is transactional-safe in Postgres 12+.
-- Placed BEFORE any references to the new values in the same transaction is
-- not allowed on some versions, so committed in its own do-block and used
-- afterwards via casts.
do $$ begin
  alter type order_status add value if not exists 'packing';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type order_status add value if not exists 'delivered';
exception when duplicate_object then null; end $$;

-- Invoice tracking ---------------------------------------------------------
alter table public.orders
  add column if not exists invoiced_at timestamptz,
  add column if not exists invoiced_by uuid references public.profiles(id) on delete set null;

comment on column public.orders.invoiced_at is
  'When the shop sent an invoice for this order. Independent of payment: an invoice can go before, with, or long after the money.';

-- Data migration -----------------------------------------------------------
-- Counter sales that were `paid` are physically done -- the customer has the
-- coffee -- so they become `delivered`. Their paid_at is unchanged.
update public.orders
   set status = 'delivered'
 where status = 'paid'
   and channel = 'pos';

-- Every other `paid` order becomes `pending` fulfilment. paid_at still says
-- the money is in; the fulfilment state now correctly says "we have not
-- physically done anything with it yet". The dashboard's "Paid, ready to
-- roast" tile is a compound condition (paid_at set AND status='pending') and
-- will read exactly those rows.
update public.orders
   set status = 'pending'
 where status = 'paid';

-- --------------------------------------------------------------------------
-- mark_order_paid: no longer touches fulfilment status.
--
-- Recording payment (paid_at, method, points, stock decrement, receipt) is
-- one thing. Where the coffee is in production is another. This function
-- keeps every payment-shaped effect and drops the one status change; a paid
-- order in fulfilment=pending is a real and useful state ("we have the money,
-- next is to roast it") that the dashboard reads by combining the two axes.
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
  v_bucket uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order is null then
    raise exception 'order % not found', p_order_id;
  end if;

  if v_order.paid_at is not null then
    return v_order;
  end if;

  select greatest(1, coalesce(loyalty_rupiah_per_point, 10000))
    into v_rate from public.site_settings where id = true;

  v_points := floor(v_order.total_idr::numeric / v_rate)::integer;

  update public.orders
     set paid_at = now(),
         payment_ref = coalesce(p_payment_ref, payment_ref),
         payment_method = coalesce(p_payment_method, payment_method),
         points_awarded = 0
   where id = p_order_id;

  update public.product_variants v
     set stock = greatest(0, v.stock - i.qty)
    from (
      select variant_id, sum(quantity)::integer as qty
        from public.order_items
       where order_id = p_order_id and variant_id is not null
       group by variant_id
    ) i
   where v.id = i.variant_id;

  perform public.release_order_stock(p_order_id);

  if v_points > 0 then
    if v_order.user_id is not null then
      perform public.award_loyalty_points(
        v_order.user_id, v_points, 'Order ' || v_order.human_ref, p_order_id, null
      );
      update public.orders set points_awarded = v_points where id = p_order_id;
    else
      v_bucket := public.credit_pending_points(p_order_id, v_points);
      if v_bucket is not null then
        update public.orders set points_awarded = v_points where id = p_order_id;
      end if;
    end if;
  end if;

  select * into v_order from public.orders where id = p_order_id;
  return v_order;
end;
$$;

-- --------------------------------------------------------------------------
-- record_manual_order: counter sales end at 'delivered', everything else at
-- 'pending' fulfilment (payment goes onto paid_at as usual). Everything else
-- is unchanged.
-- --------------------------------------------------------------------------
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
  p_shipping_idr integer default 0,
  p_discount_idr integer default 0,
  p_discount_reason text default null
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
  v_discount integer := greatest(0, coalesce(p_discount_idr, 0));
  v_total integer;
  v_item jsonb;
  v_variant record;
  v_quantity integer;
  v_price integer;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'An order needs at least one item.';
  end if;

  if p_channel not in ('pos', 'whatsapp', 'instagram', 'marketplace', 'other') then
    raise exception 'Unknown channel %. Orders from the website are written by the checkout, not here.', p_channel;
  end if;

  if p_mark_paid and coalesce(btrim(p_payment_method), '') = '' then
    raise exception 'Say how the money arrived.';
  end if;

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

    v_price := coalesce((v_item ->> 'unit_price_idr')::integer, v_variant.price_idr);
    if v_price < 0 then
      raise exception 'A price cannot be negative.';
    end if;

    v_subtotal := v_subtotal + (v_price * v_quantity);
  end loop;

  v_discount := least(v_discount, v_subtotal);
  v_total := (v_subtotal - v_discount) + v_shipping;

  if p_mark_paid
     and p_payment_method = 'cash'
     and p_cash_received is not null
     and p_cash_received < v_total then
    raise exception 'Cash received is less than the total.';
  end if;

  insert into public.orders (
    human_ref, channel, channel_reference, user_id, status,
    subtotal_idr, shipping_idr, unique_code, total_idr,
    discount_idr, discount_reason,
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
    v_discount, nullif(btrim(coalesce(p_discount_reason, '')), ''),
    p_payment_method,
    case when p_mark_paid and p_payment_method = 'cash' then p_cash_received else null end,
    p_staff_id, p_note,
    p_shipping_address, now()
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;

    insert into public.order_items (
      order_id, product_id, variant_id,
      name_snapshot, size_snapshot, slug_snapshot,
      unit_price_idr, quantity
    )
    select v_order_id, p.id, v.id, p.name, v.size::text, p.slug,
           coalesce((v_item ->> 'unit_price_idr')::integer, v.price_idr),
           v_quantity
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.id = (v_item ->> 'variant_id')::uuid;
  end loop;

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
    perform public.mark_order_paid(v_order_id, null, p_payment_method);

    -- A counter sale is physically done at the moment it is rung up. Every
    -- other paid manual order is still waiting to be roasted/packed/shipped
    -- (or picked up), so it stays at pending fulfilment.
    if p_channel = 'pos' then
      update public.orders set status = 'delivered' where id = v_order_id;
    end if;
  end if;

  select * into v_order from public.orders where id = v_order_id;
  return v_order;
end;
$$;
