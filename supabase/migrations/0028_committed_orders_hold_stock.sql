-- ===========================================================================
-- Publish Coffee Roasters -- an order that is being worked on holds its coffee
--
-- Stock moved at exactly one moment: payment. That was right when the only
-- path was the website, where nothing happens to an order until the money
-- arrives -- but it leaves a real gap now that the operator drives orders by
-- hand.
--
-- An order moved to `roasting` is an order somebody is roasting beans for. The
-- coffee is spoken for whether or not the transfer has landed, and until now
-- the shop would happily sell the same bags to somebody else in the meantime.
--
-- 0019 already built the mechanism for exactly this -- `reserved`, and an
-- `available` that the shop, the till and the checkout all read. Manual orders
-- have held their stock from the moment they are written. This is the same
-- hold, applied at the moment an order stops merely waiting.
--
-- Run this in Supabase -> SQL Editor, after 0027.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Hold an order's coffee.
--
-- The mirror of release_order_stock, and idempotent in the same way: the hold
-- is claimed by setting stock_reserved_at under the order's row lock, so a
-- second call finds it already claimed and does nothing.
--
-- Two orders are deliberately left alone:
--
--   already paid   -- its coffee was really decremented at settlement, and a
--                     hold on top would take the same bags off twice.
--   voided         -- it was undone as a mistake and owns nothing.
-- --------------------------------------------------------------------------
create or replace function public.reserve_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item record;
  v_available integer;
  v_name text;
  v_size text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order is null then
    raise exception 'order % not found', p_order_id;
  end if;

  if v_order.paid_at is not null
     or v_order.voided_at is not null
     or v_order.stock_reserved_at is not null then
    return;
  end if;

  -- Pass one: confirm the coffee is there before writing anything, and name
  -- what is missing if it is not. An operator told "only 2 of Gayo Arunika
  -- (200g) are free" can act; one told "could not update the order" cannot.
  for v_item in
    select i.variant_id, sum(i.quantity)::integer as qty
      from public.order_items i
     where i.order_id = p_order_id and i.variant_id is not null
     group by i.variant_id
  loop
    select v.available, p.name, v.size::text
      into v_available, v_name, v_size
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.id = v_item.variant_id
       for update of v;

    if v_available is null then
      raise exception 'One of the coffees on this order no longer exists, so it cannot be set aside.';
    end if;
    if v_available < v_item.qty then
      raise exception 'Only % of % (%) is free, and this order needs %. Add stock first, or leave the order as it is.',
        v_available, coalesce(v_name, 'that coffee'), coalesce(v_size, '?'), v_item.qty;
    end if;
  end loop;

  update public.product_variants v
     set reserved = v.reserved + i.qty
    from (
      select variant_id, sum(quantity)::integer as qty
        from public.order_items
       where order_id = p_order_id and variant_id is not null
       group by variant_id
    ) i
   where v.id = i.variant_id;

  update public.orders
     set stock_reserved_at = now()
   where id = p_order_id;
end;
$$;

revoke all on function public.reserve_order_stock(uuid) from anon, authenticated;
