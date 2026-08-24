-- ===========================================================================
-- Publish Coffee Roasters -- two soundness fixes on the order workflow
--
-- Both surfaced by a real trace through what the operator can do.
--
-- 1. `void_order` reversed stock and points on any paid order, including one
--    that had already shipped. The coffee is physically gone once a parcel
--    leaves; putting the stock back on paper leaves the shop believing it has
--    bags it does not. Voiding is for "this order was never real"; a shipped
--    order plainly was. It is refused now, with a message that names the
--    right tool.
--
-- 2. `assign_order_customer` transferred points into a newly attached
--    customer, but did not handle *reassignment* -- attaching Alice then
--    reassigning to Bob left Alice holding the points and gave Bob nothing.
--    The reversal was there for a full detach and never chained with the
--    reattach. The fixed version routes points off the old customer and onto
--    the new one atomically, so any move (attach, reassign, detach) leaves
--    exactly one balance changed by the right amount.
--
-- Run this in Supabase -> SQL Editor, after 0033.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Void: refuse anything that has shipped.
--
-- Everything else is unchanged from 0023's definition. A shipped-then-void
-- silently rewrote stock, which is the class of bug that only surfaces the
-- day the operator counts the shelf.
-- --------------------------------------------------------------------------
create or replace function public.void_order(
  p_order_id uuid,
  p_reason text default null,
  p_by uuid default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_held boolean;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order is null then
    raise exception 'order % not found', p_order_id;
  end if;

  if v_order.channel = 'online' then
    raise exception 'A website order cannot be voided -- a real payment went through for it. Cancel it instead, so the record still matches what the customer was charged.';
  end if;

  -- A parcel that has left cannot be undone by ticking a box. Guard by
  -- shipped_at OR the status past it, either being enough on its own -- old
  -- data may only carry the status, and status alone is what the operator sees.
  if v_order.shipped_at is not null
     or v_order.status in ('shipped'::order_status, 'completed'::order_status) then
    raise exception 'This order has already shipped, so it cannot be voided -- the coffee has left the building and the stock count would be wrong. If the customer is returning it, mark the order cancelled and adjust the stock by hand once the parcel is back.';
  end if;

  if v_order.voided_at is not null then
    return v_order;
  end if;

  v_held := v_order.stock_reserved_at is not null;
  if v_held then
    perform public.release_order_stock(p_order_id);
  end if;

  if v_order.paid_at is not null then
    update public.product_variants v
       set stock = v.stock + i.qty
      from (
        select variant_id, sum(quantity)::integer as qty
          from public.order_items
         where order_id = p_order_id and variant_id is not null
         group by variant_id
      ) i
     where v.id = i.variant_id;

    if v_order.points_awarded > 0 then
      if v_order.user_id is not null then
        perform public.award_loyalty_points(
          v_order.user_id, -v_order.points_awarded,
          'Voided order ' || v_order.human_ref, p_order_id, p_by
        );
      else
        perform public.debit_pending_points(p_order_id, v_order.points_awarded);
      end if;
    end if;
  end if;

  update public.orders
     set voided_at = now(),
         voided_reason = p_reason,
         voided_by = p_by,
         voided_held_stock = v_held
   where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- --------------------------------------------------------------------------
-- Reassignment: money moves off the old customer and onto the new one in one
-- step, however the id changes.
--
-- The three shapes:
--
--   null -> user      attach. Take from the pending bucket if there is one;
--                     otherwise award `points_awarded` directly, since that
--                     is what the order says it earned.
--   user -> user      reassign. Reverse the old, award the new. Skip if the
--                     two are the same, so a save-then-save is inert.
--   user -> null      detach. Reverse the old only.
--
-- All three are gated on paid_at: nothing to move for an unpaid order.
-- --------------------------------------------------------------------------
create or replace function public.assign_order_customer(
  p_order_id uuid,
  p_user_id uuid
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_bucket public.pending_loyalty;
  v_previous_user uuid;
  v_points integer;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order is null then
    raise exception 'order % not found', p_order_id;
  end if;
  if v_order.voided_at is not null then
    raise exception 'That order was voided; put it back first.';
  end if;

  -- Same customer already: no work.
  if v_order.user_id is not distinct from p_user_id then
    return v_order;
  end if;

  v_previous_user := v_order.user_id;
  v_points := v_order.points_awarded;

  update public.orders set user_id = p_user_id where id = p_order_id;

  -- Nothing to move if not paid. Points get awarded on payment against
  -- whoever is attached at that moment.
  if v_order.paid_at is null then
    select * into v_order from public.orders where id = p_order_id;
    return v_order;
  end if;

  -- Take back from the previous customer, if there was one. Uses the ledger,
  -- so their history keeps both the award and the reversal and adds up.
  if v_previous_user is not null and v_points > 0 then
    perform public.award_loyalty_points(
      v_previous_user, -v_points,
      'Order ' || v_order.human_ref || ' moved to another customer', p_order_id, null
    );
  end if;

  -- Give to the new customer, if there is one.
  if p_user_id is not null and v_points > 0 then
    -- Prefer the pending bucket when it still has the points -- keeps the
    -- narrative on the ledger honest ("collected from the bucket") for the
    -- most common path (first attach). Reassignment (chaining after a
    -- previous attach) sees an empty bucket and falls through to a direct
    -- award of what the order recorded earning.
    select * into v_bucket
      from public.pending_loyalty
     where id = v_order.pending_loyalty_id
       and claimed_at is null
       for update;

    if v_bucket.id is not null and v_bucket.points > 0 then
      perform public.award_loyalty_points(
        p_user_id, v_bucket.points,
        'Order ' || v_order.human_ref || ' attached to customer',
        p_order_id, null
      );
      update public.pending_loyalty
         set points = 0, claimed_by = p_user_id, claimed_at = now()
       where id = v_bucket.id;
    else
      perform public.award_loyalty_points(
        p_user_id, v_points,
        'Order ' || v_order.human_ref || ' attached to customer',
        p_order_id, null
      );
    end if;
  end if;

  select * into v_order from public.orders where id = p_order_id;
  return v_order;
end;
$$;
