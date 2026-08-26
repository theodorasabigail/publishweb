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

do $$
begin
  execute $sql$
    update public.orders
       set status = 'delivered'::public.order_status
     where channel = 'pos'
       and paid_at is not null
       and status = 'pending'::public.order_status
  $sql$;
exception when others then
  raise notice
    'Skipping POS delivered backfill on this run (%). It will complete on the next setup.sql paste.',
    sqlerrm;
end $$;
