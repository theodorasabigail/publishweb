-- ===========================================================================
-- Publish Coffee Roasters -- undoing an order that was typed wrong
--
-- Orders written by hand can be written wrong: the wrong coffee rung up at the
-- counter, a WhatsApp order entered twice, a size picked from the row above.
-- Until now the only way back was `cancelled`, which is a different statement.
-- Cancelled means "this order was real and is not going ahead". A miskeyed one
-- was never real at all, and leaving it in the takings misreports the day.
--
-- So: voiding. It reverses everything the order did -- releases any hold, puts
-- the coffee back if it had been paid for, takes back the loyalty points --
-- and then hides the order from the books while keeping the row, so there is
-- still a trace that something was entered and undone. Restoring puts it all
-- back, which is what makes voiding safe to reach for.
--
-- Deleting outright is separate, deliberate, and only reachable once an order
-- is already voided. By then the reversal has happened, so a delete is only
-- the removal of a record -- never a silent change to stock or points.
--
-- Neither applies to website orders. A real payment went through a real
-- provider for those, and the shop's records should keep matching it.
--
-- Run this in Supabase -> SQL Editor, after 0020.
-- ===========================================================================

alter table public.orders
  add column if not exists voided_at timestamptz,
  add column if not exists voided_reason text,
  add column if not exists voided_by uuid references public.profiles(id) on delete set null,
  -- Whether this order was holding stock when it was voided. The hold itself
  -- is released, so `stock_reserved_at` is cleared and cannot answer this --
  -- but restoring has to know whether to take the hold back out again.
  add column if not exists voided_held_stock boolean not null default false;

comment on column public.orders.voided_at is
  'Set when an order was undone as a mistake. A voided order keeps its row but is excluded from every report, list and total.';
comment on column public.orders.voided_held_stock is
  'Whether the order held reserved stock at the moment it was voided, so restoring can put the hold back.';

-- Voided orders are the exception everywhere, so the index that matters is the
-- one over everything that is *not* voided.
create index if not exists orders_live_created_idx
  on public.orders(created_at desc) where voided_at is null;

-- --------------------------------------------------------------------------
-- Void an order: undo everything it did, keep the record.
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

  -- Idempotent: voiding twice must not put the stock back twice.
  if v_order.voided_at is not null then
    return v_order;
  end if;

  v_held := v_order.stock_reserved_at is not null;
  if v_held then
    perform public.release_order_stock(p_order_id);
  end if;

  -- A paid order already turned its coffee into a real decrement, so undoing
  -- it means putting actual stock back on the shelf.
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

    -- Points come back through the ledger rather than by editing the balance,
    -- so the customer's history shows the award and the reversal as two
    -- entries and still adds up.
    if v_order.user_id is not null and v_order.points_awarded > 0 then
      perform public.award_loyalty_points(
        v_order.user_id,
        -v_order.points_awarded,
        'Voided order ' || v_order.human_ref,
        p_order_id,
        p_by
      );
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
-- Restore a voided order: re-apply what voiding undid.
--
-- Checked before anything is written, because the coffee may have been sold to
-- somebody else in the meantime. Refusing with a message the operator can act
-- on beats restoring an order the shop can no longer fulfil.
-- --------------------------------------------------------------------------
create or replace function public.restore_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item record;
  v_available integer;
  v_name text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order is null then
    raise exception 'order % not found', p_order_id;
  end if;
  if v_order.voided_at is null then
    return v_order;
  end if;

  -- Pass one: confirm every line can be honoured, before touching anything.
  if v_order.paid_at is not null or v_order.voided_held_stock then
    for v_item in
      select i.variant_id, sum(i.quantity)::integer as qty
        from public.order_items i
       where i.order_id = p_order_id and i.variant_id is not null
       group by i.variant_id
    loop
      select v.available, p.name
        into v_available, v_name
        from public.product_variants v
        join public.products p on p.id = v.product_id
       where v.id = v_item.variant_id
         for update of v;

      if v_available is null then
        raise exception 'One of the coffees on this order no longer exists, so it cannot be put back.';
      end if;
      if v_available < v_item.qty then
        raise exception 'Only % of % is free, and this order needs %. Adjust the stock first, then restore it.',
          v_available, coalesce(v_name, 'that coffee'), v_item.qty;
      end if;
    end loop;
  end if;

  -- Pass two: re-apply.
  if v_order.paid_at is not null then
    update public.product_variants v
       set stock = greatest(0, v.stock - i.qty)
      from (
        select variant_id, sum(quantity)::integer as qty
          from public.order_items
         where order_id = p_order_id and variant_id is not null
         group by variant_id
      ) i
     where v.id = i.variant_id;

    if v_order.user_id is not null and v_order.points_awarded > 0 then
      perform public.award_loyalty_points(
        v_order.user_id,
        v_order.points_awarded,
        'Restored order ' || v_order.human_ref,
        p_order_id,
        null
      );
    end if;
  end if;

  if v_order.voided_held_stock then
    update public.product_variants v
       set reserved = v.reserved + i.qty
      from (
        select variant_id, sum(quantity)::integer as qty
          from public.order_items
         where order_id = p_order_id and variant_id is not null
         group by variant_id
      ) i
     where v.id = i.variant_id;
  end if;

  update public.orders
     set voided_at = null,
         voided_reason = null,
         voided_by = null,
         voided_held_stock = false,
         -- The local variable, not the column: inside an UPDATE a bare column
         -- reads its old value, which is right but far too subtle to lean on.
         stock_reserved_at = case
           when v_order.voided_held_stock then now()
           else stock_reserved_at
         end
   where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- --------------------------------------------------------------------------
-- Remove a voided order for good.
--
-- Only reachable once an order is voided, which is what makes this safe: the
-- stock and the points were already put back, so this deletes a record and
-- nothing else. Order lines go with it; the loyalty ledger keeps its entries,
-- naming the order in their text, so a customer's points history still adds up
-- after the order itself is gone.
-- --------------------------------------------------------------------------
create or replace function public.delete_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order is null then
    raise exception 'order % not found', p_order_id;
  end if;

  if v_order.channel = 'online' then
    raise exception 'A website order cannot be deleted -- a real payment went through for it.';
  end if;

  if v_order.voided_at is null then
    raise exception 'Void this order first. Voiding is what puts its stock and points back; deleting only removes the record, and doing that to a live order would leave your stock wrong.';
  end if;

  delete from public.orders where id = p_order_id;
end;
$$;

revoke all on function public.void_order(uuid, text, uuid) from anon, authenticated;
revoke all on function public.restore_order(uuid) from anon, authenticated;
revoke all on function public.delete_order(uuid) from anon, authenticated;

-- --------------------------------------------------------------------------
-- Every report learns to skip voided orders.
--
-- Recreated wholesale rather than patched, because a report that counts a
-- voided order is the entire failure this feature exists to prevent, and
-- "which of these four had the filter added" is not a question worth having.
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
    o.channel::text,
    coalesce(o.payment_method, 'unknown'),
    count(*)::bigint,
    coalesce(sum(o.total_idr), 0)::bigint
  from public.orders o
  where o.paid_at >= p_from
    and o.paid_at < p_to
    and o.status <> 'cancelled'
    and o.voided_at is null
  group by o.channel, coalesce(o.payment_method, 'unknown')
  order by o.channel, coalesce(o.payment_method, 'unknown');
$$;

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
    coalesce(sum(i.quantity) filter (where o.channel = 'online'), 0)::bigint,
    coalesce(sum(i.quantity) filter (where o.channel = 'pos'), 0)::bigint,
    coalesce(sum(i.quantity) filter (where o.channel not in ('online', 'pos')), 0)::bigint
  from public.order_items i
  join public.orders o on o.id = i.order_id
  where o.paid_at >= p_from
    and o.paid_at < p_to
    and o.status <> 'cancelled'
    and o.voided_at is null
  group by i.name_snapshot, i.size_snapshot
  order by sum(i.quantity) desc;
$$;

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
    coalesce(o.shipping_zone, 'unknown'),
    count(*)::bigint,
    coalesce(sum(o.shipping_idr), 0)::bigint,
    coalesce(sum(o.shipping_discount_idr), 0)::bigint
  from public.orders o
  where o.paid_at >= p_from
    and o.paid_at < p_to
    and o.status <> 'cancelled'
    and o.voided_at is null
    and o.channel = 'online'
  group by coalesce(o.shipping_zone, 'unknown')
  order by coalesce(sum(o.shipping_discount_idr), 0) desc;
$$;

create or replace function public.courier_price_variances(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  order_id uuid,
  human_ref text,
  shipping_charged_idr integer,
  courier_charged_idr integer,
  variance_idr integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id,
    o.human_ref,
    o.shipping_idr,
    o.courier_charged_idr,
    (o.courier_charged_idr - o.shipping_idr)::integer,
    o.created_at
  from public.orders o
  cross join lateral (
    select coalesce(courier_variance_alert_idr, 10000) as threshold
    from public.site_settings where id = true
  ) s
  where o.courier_charged_idr is not null
    and o.created_at >= p_from
    and o.created_at < p_to
    and o.voided_at is null
    and (o.courier_charged_idr - o.shipping_idr) >= s.threshold
  order by (o.courier_charged_idr - o.shipping_idr) desc;
$$;

revoke all on function public.sales_summary(timestamptz, timestamptz) from anon, authenticated;
revoke all on function public.product_sales_report(timestamptz, timestamptz) from anon, authenticated;
revoke all on function public.shipping_summary(timestamptz, timestamptz) from anon, authenticated;
revoke all on function public.courier_price_variances(timestamptz, timestamptz) from anon, authenticated;
