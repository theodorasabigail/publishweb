-- ===========================================================================
-- Publish Coffee Roasters -- retire "completed" as a status the flow reaches
--
-- Two moments used to promote an order to `completed`:
--
--   record_manual_order   for a counter sale (no address to ship to)
--   biteship webhook      when the courier reported delivery
--
-- Neither adds anything for this shop. A counter sale is done the moment it
-- is rung up -- `paid` says that already. A shipped parcel is done the moment
-- it ships; delivery is not a state the shop tracks, and treating it as one
-- pretends to know something Biteship's own webhooks are not reliable enough
-- to answer.
--
-- Existing rows are remapped by their shipped_at: a completed order that
-- shipped becomes `shipped`, one that never did becomes `paid`. Going
-- forward, nothing writes `completed` at all; the enum value stays because
-- Postgres cannot drop enum values, but it is inert.
--
-- Run this in Supabase -> SQL Editor, after 0035.
-- ===========================================================================

update public.orders
   set status = case
                  when shipped_at is not null then 'shipped'::order_status
                  else 'paid'::order_status
                end
 where status = 'completed';

-- --------------------------------------------------------------------------
-- record_manual_order without the auto-complete branch. Everything else is
-- unchanged from 0035; only the one line that promoted to 'completed' when
-- there was no address is gone.
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
    -- No auto-promotion to `completed` here. A counter sale ends at `paid` --
    -- there is nothing to ship, so nothing left to do -- and any manual order
    -- with an address ends at `paid` until the operator ships it, exactly
    -- like a website order does.
  end if;

  select * into v_order from public.orders where id = v_order_id;
  return v_order;
end;
$$;
