-- ===========================================================================
-- Publish Coffee Roasters -- payment is its own dimension of an order
--
-- `mark_order_paid` set the fulfilment status to `paid` alongside stamping
-- `paid_at`. That was right when the two moved together: a website order was
-- never fulfilled until the money arrived. It is wrong for a shop that
-- routinely ships first and collects later -- recording the payment then
-- walked a shipped order backwards to "paid", losing the fulfilment progress
-- the operator had already tracked.
--
-- Fulfilment and payment are independent, and always were: paid_at is the
-- authoritative "money arrived" moment and shipped_at is the authoritative
-- "parcel left" one. This migration teaches the settlement path to leave the
-- fulfilment status alone once it has moved past `pending`. `pending` still
-- gets promoted to `paid`, because "paid but not yet started" is a real state
-- the roaster wants to see on the ready-to-roast list.
--
-- Run this in Supabase -> SQL Editor, after 0029.
-- ===========================================================================

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
  v_next_status order_status;
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

  -- Only promote from `pending`. An operator who has moved the order to
  -- roasting, shipped or completed already knows more than the payment step,
  -- and money arriving after the fact should not undo that work.
  v_next_status := case
    when v_order.status = 'pending' then 'paid'::order_status
    else v_order.status
  end;

  update public.orders
     set status = v_next_status,
         paid_at = now(),
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
