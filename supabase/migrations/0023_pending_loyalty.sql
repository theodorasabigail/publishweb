-- ===========================================================================
-- Publish Coffee Roasters -- points for people who do not have an account yet
--
-- Loyalty points only ever went to a signed-in customer. Everyone else -- the
-- guest checking out online, and above all the WhatsApp regular who has never
-- touched the website -- earned nothing, which is backwards: they are the ones
-- an account most needs selling to.
--
-- Points now accrue against whatever the shop knows about the buyer, and wait.
-- When that person signs up, the waiting points follow them in.
--
-- `profiles` is foreign-keyed to `auth.users`, so there is nowhere to hang
-- points for somebody who has not signed up -- hence a table of their own,
-- keyed on a contact detail rather than on a person.
--
-- Run this in Supabase -> SQL Editor, after 0022.
-- ===========================================================================

create table if not exists public.pending_loyalty (
  id uuid primary key default gen_random_uuid(),
  -- Which kind of contact detail this is keyed on. The distinction matters
  -- because only one of them can be trusted to identify somebody: see
  -- claim_pending_points below.
  kind text not null check (kind in ('email', 'phone')),
  identifier text not null,
  points integer not null default 0 check (points >= 0),
  lifetime_points integer not null default 0,
  order_count integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  unique (kind, identifier)
);

create index if not exists pending_loyalty_unclaimed_idx
  on public.pending_loyalty(last_seen_at desc) where claimed_at is null;

alter table public.pending_loyalty enable row level security;

drop policy if exists "pending_loyalty: admin only" on public.pending_loyalty;
create policy "pending_loyalty: admin only" on public.pending_loyalty
  for all using (public.is_admin()) with check (public.is_admin());

comment on table public.pending_loyalty is
  'Loyalty points earned by someone who had no account at the time. Keyed on a contact detail rather than a person, and emptied into a real profile when one turns up.';

-- Which bucket an order's points went to, so voiding it can take them back out
-- of the same place they went in.
alter table public.orders
  add column if not exists pending_loyalty_id uuid
    references public.pending_loyalty(id) on delete set null;

-- --------------------------------------------------------------------------
-- Normalising a contact detail.
--
-- Two orders from the same person must land in the same bucket, and people do
-- not type their own phone number the same way twice: 0812…, +62 812…,
-- 62812…, with or without spaces and dashes. Everything is reduced to one
-- form so those are one customer rather than four.
-- --------------------------------------------------------------------------
create or replace function public.normalise_loyalty_email(p_value text)
returns text
language sql
immutable
as $$
  select nullif(lower(btrim(coalesce(p_value, ''))), '');
$$;

create or replace function public.normalise_loyalty_phone(p_value text)
returns text
language sql
immutable
as $$
  select case
    -- Too short to be a real number, so more likely a house number that found
    -- its way into the wrong box. Better to hold no points than to pool
    -- several people's under "12".
    when length(digits) < 8 then null
    when left(digits, 2) = '62' then digits
    when left(digits, 1) = '0' then '62' || substr(digits, 2)
    else digits
  end
  from (
    select regexp_replace(coalesce(p_value, ''), '\D', '', 'g') as digits
  ) cleaned;
$$;

-- --------------------------------------------------------------------------
-- Put points aside for whoever this order belongs to.
--
-- Email is preferred over phone wherever both are known, because email is the
-- one that can later be claimed without a person having to be believed.
-- Returns null when the order carries no contact detail at all -- a walk-in
-- counter sale -- in which case there is nobody to hold points for.
-- --------------------------------------------------------------------------
create or replace function public.credit_pending_points(
  p_order_id uuid,
  p_points integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_kind text;
  v_identifier text;
  v_bucket uuid;
begin
  if p_points is null or p_points <= 0 then
    return null;
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if v_order is null then
    return null;
  end if;

  v_identifier := public.normalise_loyalty_email(
    coalesce(v_order.guest_email, v_order.shipping_address ->> 'email')
  );

  if v_identifier is not null then
    v_kind := 'email';
  else
    v_identifier := public.normalise_loyalty_phone(
      coalesce(
        v_order.shipping_address ->> 'phone',
        -- A WhatsApp order's reference *is* the customer's phone number.
        case when v_order.channel = 'whatsapp' then v_order.channel_reference end
      )
    );
    if v_identifier is not null then
      v_kind := 'phone';
    end if;
  end if;

  if v_identifier is null then
    return null;
  end if;

  insert into public.pending_loyalty (kind, identifier, points, lifetime_points, order_count)
  values (v_kind, v_identifier, p_points, p_points, 1)
  on conflict (kind, identifier) do update
     set points = pending_loyalty.points + excluded.points,
         lifetime_points = pending_loyalty.lifetime_points + excluded.lifetime_points,
         order_count = pending_loyalty.order_count + 1,
         last_seen_at = now(),
         -- Somebody who has already collected once and orders again as a guest
         -- starts a fresh balance rather than reopening the old one.
         claimed_by = null,
         claimed_at = null
  returning id into v_bucket;

  update public.orders set pending_loyalty_id = v_bucket where id = p_order_id;
  return v_bucket;
end;
$$;

-- --------------------------------------------------------------------------
-- Take them back out again, for an order that is being voided.
--
-- Floors at zero: if the points were already collected into a real account,
-- the bucket is empty and there is nothing here to reclaim. Chasing them into
-- the customer's account would mean taking points off somebody for a mistake
-- the shop made.
-- --------------------------------------------------------------------------
create or replace function public.debit_pending_points(
  p_order_id uuid,
  p_points integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket uuid;
begin
  select pending_loyalty_id into v_bucket from public.orders where id = p_order_id;
  if v_bucket is null or p_points is null or p_points <= 0 then
    return;
  end if;

  update public.pending_loyalty
     set points = greatest(0, points - p_points),
         lifetime_points = greatest(0, lifetime_points - p_points),
         order_count = greatest(0, order_count - 1)
   where id = v_bucket;
end;
$$;

-- --------------------------------------------------------------------------
-- Collect waiting points into a real account.
--
-- Only ever by email, and only the email Supabase already holds for the
-- account -- which it has confirmed, through a link the person had to open or
-- through the provider they signed in with. A phone number is not confirmed by
-- anything: `profiles.phone` is whatever was typed into a form, so claiming by
-- it would let anyone who enters a number that has been buying coffee walk off
-- with somebody else's balance. Phone buckets are handed over by the operator
-- instead, in `link_pending_points`.
--
-- Safe to call on every sign-in: a collected bucket has nothing left in it.
-- --------------------------------------------------------------------------
create or replace function public.claim_pending_points(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_bucket public.pending_loyalty;
begin
  if p_user_id is null then
    return 0;
  end if;

  -- auth.users, not profiles: this is the confirmed address, and the whole
  -- reason email is trusted where phone is not.
  select public.normalise_loyalty_email(u.email)
    into v_email
    from auth.users u
   where u.id = p_user_id
     and u.email_confirmed_at is not null;

  if v_email is null then
    return 0;
  end if;

  select * into v_bucket
    from public.pending_loyalty
   where kind = 'email' and identifier = v_email and claimed_at is null
     for update;

  if v_bucket is null or v_bucket.points <= 0 then
    return 0;
  end if;

  perform public.award_loyalty_points(
    p_user_id,
    v_bucket.points,
    'Points earned before you had an account',
    null,
    null
  );

  update public.pending_loyalty
     set points = 0, claimed_by = p_user_id, claimed_at = now()
   where id = v_bucket.id;

  return v_bucket.points;
end;
$$;

-- --------------------------------------------------------------------------
-- Hand a bucket to a customer by hand.
--
-- The operator's route, and the only way a phone bucket ever moves. They are
-- the one who can tell whether the person in front of them is the person whose
-- number that is -- which is a judgement, and belongs to a human.
-- --------------------------------------------------------------------------
create or replace function public.link_pending_points(
  p_user_id uuid,
  p_identifier text,
  p_by uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket public.pending_loyalty;
  v_email text := public.normalise_loyalty_email(p_identifier);
  v_phone text := public.normalise_loyalty_phone(p_identifier);
begin
  if p_user_id is null then
    raise exception 'Pick a customer to give these points to.';
  end if;

  -- Whatever was typed, matched as either kind. An operator copying a contact
  -- detail out of a chat should not have to say which sort it is.
  select * into v_bucket
    from public.pending_loyalty
   where claimed_at is null
     and ((kind = 'email' and identifier = v_email)
       or (kind = 'phone' and identifier = v_phone))
   order by points desc
   limit 1
     for update;

  if v_bucket is null then
    raise exception 'No points are waiting against %. Check the spelling, or the number the order was placed from.', p_identifier;
  end if;

  perform public.award_loyalty_points(
    p_user_id,
    v_bucket.points,
    'Points collected from ' || v_bucket.identifier,
    null,
    p_by
  );

  update public.pending_loyalty
     set points = 0, claimed_by = p_user_id, claimed_at = now()
   where id = v_bucket.id;

  return v_bucket.points;
end;
$$;

-- --------------------------------------------------------------------------
-- Settlement, now awarding points to everybody who can be identified.
--
-- Replaces the definition in 0019. The change is the else branch: an order
-- with no account behind it used to record zero points and move on. It now
-- puts them aside against the buyer's email or phone, and only records zero
-- when there is genuinely nobody to hold them for.
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
     set status = 'paid',
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
      -- No account, but usually still a person we can name. Points wait for
      -- them; `points_awarded` records them either way, so the order shows
      -- what it earned rather than a bare zero.
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

revoke all on function public.credit_pending_points(uuid, integer) from anon, authenticated;
revoke all on function public.debit_pending_points(uuid, integer) from anon, authenticated;
revoke all on function public.claim_pending_points(uuid) from anon, authenticated;
revoke all on function public.link_pending_points(uuid, text, uuid) from anon, authenticated;

-- --------------------------------------------------------------------------
-- Voiding and restoring, now that a guest order can carry points too.
--
-- Replaces the definitions in 0021. Same shape; the only change is that points
-- are put back wherever they came from -- a customer's balance, or the bucket
-- waiting for whoever they belong to.
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
          v_order.user_id,
          -v_order.points_awarded,
          'Voided order ' || v_order.human_ref,
          p_order_id,
          p_by
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

    if v_order.points_awarded > 0 then
      if v_order.user_id is not null then
        perform public.award_loyalty_points(
          v_order.user_id,
          v_order.points_awarded,
          'Restored order ' || v_order.human_ref,
          p_order_id,
          null
        );
      else
        perform public.credit_pending_points(p_order_id, v_order.points_awarded);
      end if;
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
         stock_reserved_at = case
           when v_order.voided_held_stock then now()
           else stock_reserved_at
         end
   where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;
