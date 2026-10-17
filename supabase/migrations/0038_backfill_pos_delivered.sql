-- ===========================================================================
-- Publish Coffee Roasters -- backfill historical POS orders to `delivered`
--
-- 0037 could not do this in the same transaction that added the `delivered`
-- enum value: Postgres refuses to reference a newly-added enum member until
-- the ADD has been committed. This file finishes the job on a *later* run of
-- setup.sql, once 0037's ADD VALUE is already committed and using the value
-- is safe.
--
-- Wrapped in a DO block with an exception handler because Supabase's SQL
-- editor runs each pasted script as one transaction, and if the operator
-- somehow triggers both migrations in one transaction the UPDATE would abort
-- everything. A DO block's exception handler creates an internal savepoint,
-- so if the same-transaction restriction fires here we swallow it, print a
-- notice, and let the rest of setup.sql keep going. A subsequent paste
-- (with the enum ADD already committed) completes the backfill.
--
-- Every counter sale that has been paid is physically done -- the customer
-- walked away with the coffee -- so its fulfilment state should read as such
-- rather than "awaiting fulfilment", which is the pending badge.
-- ===========================================================================

-- Runs once. setup.sql is pasted again with every new feature, and a backfill
-- that ran every time would also close counter sales that are rightly still
-- open: one reopened by hand, or one paid now and collected after the roast.
-- The marker row says it has been done; once it exists this is a no-op.
create table if not exists public.migration_markers (
  name text primary key,
  done_at timestamptz not null default now()
);
-- Internal bookkeeping, never read by the site: no policies, so the public API
-- cannot see or change it.
alter table public.migration_markers enable row level security;

do $$
begin
  if exists (select 1 from public.migration_markers where name = '0038_backfill_pos_delivered') then
    return;
  end if;

  execute $sql$
    update public.orders
       set status = 'delivered'::public.order_status
     where channel = 'pos'
       and paid_at is not null
       and status = 'pending'::public.order_status
  $sql$;

  insert into public.migration_markers (name) values ('0038_backfill_pos_delivered');
exception when others then
  raise notice
    'Skipping POS delivered backfill on this run (%). It will complete on the next setup.sql paste.',
    sqlerrm;
end $$;
