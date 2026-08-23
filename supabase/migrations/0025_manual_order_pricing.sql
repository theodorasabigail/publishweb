-- ===========================================================================
-- Publish Coffee Roasters -- bulk prices and discounts on orders taken by hand
--
-- `record_manual_order` prices every line from the catalogue and refuses to
-- take a price from the screen. That is the right default -- it is what stops
-- a typo at the till from quietly selling coffee at the wrong price, and it
-- stays the default here.
--
-- But a shop that sells 5kg to a cafe does not sell it at the retail 200g
-- rate, and "we agreed 10% off because they came back" is a real thing that
-- happened. Refusing to record either does not make them go away; it makes
-- them happen off the books, which is worse.
--
-- So an override is possible, and deliberate: a price has to be typed in place
-- of the catalogue one, per line, and a discount has to carry a reason. What
-- was actually charged is snapshotted on the order line exactly as it always
-- was, so a wholesale price is history rather than a rule.
--
-- Run this in Supabase -> SQL Editor, after 0024.
-- ===========================================================================

alter table public.orders
  add column if not exists discount_idr integer not null default 0 check (discount_idr >= 0),
  add column if not exists discount_reason text;

comment on column public.orders.discount_idr is
  'Taken off the coffee, not the shipping. Shipping is subsidised separately through shipping_discount_idr, so the two never have to be untangled afterwards.';
comment on column public.orders.discount_reason is
  'Why this order was discounted. Free text, for the operator -- a discount with no reason is indistinguishable from a mistake a month later.';

-- --------------------------------------------------------------------------
-- Write an order that was agreed somewhere other than the website.
--
-- Replaces the definition in 0019. Two additions:
--
--   a per-line "unit_price_idr" in p_items, which overrides the catalogue
--   price for that line only, and
--
--   p_discount_idr, taken off the coffee once the lines are totalled.
--
-- Everything else is unchanged: availability is still locked and checked
-- before anything is written, and settlement still runs through mark_order_paid.
-- --------------------------------------------------------------------------
-- Dropped, not just replaced. Adding parameters makes a *new* function rather
-- than a new version of this one, and the old eleven-argument signature would
-- still be sitting there -- with defaults on both, a call naming fewer than
-- eleven arguments matches each of them equally and Postgres refuses to pick.
-- The application calls this through PostgREST, which would meet exactly the
-- same ambiguity.
drop function if exists public.record_manual_order(
  jsonb, text, text, boolean, integer, uuid, uuid, text, text, jsonb, integer
);

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
  v_ships boolean := p_shipping_address is not null;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'An order needs at least one item.';
  end if;

  if p_channel not in ('pos', 'whatsapp', 'instagram', 'marketplace', 'other') then
    raise exception 'Unknown channel %. Orders from the website are written by the checkout, not here.', p_channel;
  end if;

  if p_mark_paid and coalesce(p_payment_method, '') not in ('cash', 'qris', 'card', 'transfer') then
    raise exception 'Unknown payment method %', coalesce(p_payment_method, '(none)');
  end if;
  if not p_mark_paid
     and p_payment_method is not null
     and p_payment_method not in ('cash', 'qris', 'card', 'transfer') then
    raise exception 'Unknown payment method %', p_payment_method;
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

    -- The catalogue price unless one was typed in its place. Null and absent
    -- both mean "use the catalogue", so an override is always something
    -- somebody entered on purpose rather than something a blank field did.
    v_price := coalesce((v_item ->> 'unit_price_idr')::integer, v_variant.price_idr);
    if v_price < 0 then
      raise exception 'A price cannot be negative.';
    end if;

    v_subtotal := v_subtotal + (v_price * v_quantity);
  end loop;

  -- A discount bigger than the coffee would make the order a refund, which is
  -- not a thing this can record. Capped rather than refused, since the
  -- intention -- "this one is free" -- is clear enough to honour.
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

  -- The line snapshots what was actually charged, which is the whole point of
  -- snapshotting: a wholesale price is a fact about this order, never a rule
  -- that leaks back into the catalogue.
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
    if not v_ships then
      update public.orders set status = 'completed' where id = v_order_id;
    end if;
  end if;

  select * into v_order from public.orders where id = v_order_id;
  return v_order;
end;
$$;

revoke all on function public.record_manual_order(jsonb, text, text, boolean, integer, uuid, uuid, text, text, jsonb, integer, integer, text) from anon, authenticated;
