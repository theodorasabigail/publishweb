-- ===========================================================================
-- Publish Coffee Roasters -- attach a customer to an order after the fact
--
-- Orders written without a customer -- a walk-in that later turned out to be
-- a regular, a WhatsApp order for someone who has since signed up -- had no
-- way to be attached to a real account. And doing this correctly is more than
-- just setting user_id: an order paid without an account puts its points into
-- a pending-loyalty bucket keyed on the buyer's email or phone. Attaching a
-- customer needs to collect those held points into the customer's balance too,
-- otherwise the operator sees the account and the ledger disagree on what the
-- customer earned.
--
-- Run this in Supabase -> SQL Editor, after 0032.
-- ===========================================================================

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
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order is null then
    raise exception 'order % not found', p_order_id;
  end if;
  if v_order.voided_at is not null then
    raise exception 'That order was voided; put it back first.';
  end if;

  -- No-op if we are asked for the same customer that is already attached,
  -- so a save-then-save cannot double-award points.
  if v_order.user_id is not distinct from p_user_id then
    return v_order;
  end if;

  update public.orders set user_id = p_user_id where id = p_order_id;

  -- If the order paid into a pending-loyalty bucket, move those points to the
  -- newly attached customer through the ledger, and mark the bucket claimed.
  -- Handled by direction, not idempotency: this branch only runs when a real
  -- transfer is due (unclaimed bucket, some points, a user to give them to).
  if p_user_id is not null and v_order.pending_loyalty_id is not null then
    select * into v_bucket
      from public.pending_loyalty
     where id = v_order.pending_loyalty_id
       and claimed_at is null
       for update;

    if v_bucket.id is not null and v_bucket.points > 0 then
      perform public.award_loyalty_points(
        p_user_id,
        v_bucket.points,
        'Order ' || v_order.human_ref || ' attached to customer',
        p_order_id,
        null
      );

      update public.pending_loyalty
         set points = 0, claimed_by = p_user_id, claimed_at = now()
       where id = v_bucket.id;
    end if;
  end if;

  -- If the order is being *detached* (user_id set to null) and it had already
  -- been paid to a real customer, take those points back the same way voiding
  -- does. Anything else and there is nothing to unwind.
  if p_user_id is null
     and v_order.user_id is not null
     and v_order.paid_at is not null
     and v_order.points_awarded > 0 then
    perform public.award_loyalty_points(
      v_order.user_id,
      -v_order.points_awarded,
      'Customer detached from order ' || v_order.human_ref,
      p_order_id,
      null
    );
  end if;

  select * into v_order from public.orders where id = p_order_id;
  return v_order;
end;
$$;

revoke all on function public.assign_order_customer(uuid, uuid) from anon, authenticated;
