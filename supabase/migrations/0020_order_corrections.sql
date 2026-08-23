-- ===========================================================================
-- Publish Coffee Roasters -- when the parcel actually left
--
-- An order has always recorded when it was placed and when it was paid, but
-- never when it shipped. "Shipped" was a status and nothing more, so the one
-- question a customer actually asks -- *when* did it go out -- had no answer
-- in the database, and the gap between paying and posting could not be seen
-- at all.
--
-- Null on every existing order, including ones already marked shipped: the
-- date was never recorded, and inventing one would be worse than admitting
-- that. The admin lets the operator fill them in by hand where it matters.
--
-- Run this in Supabase -> SQL Editor, after 0019.
-- ===========================================================================

alter table public.orders
  add column if not exists shipped_at timestamptz;

comment on column public.orders.shipped_at is
  'When the parcel actually left. Stamped when an order is first marked shipped, and correctable by hand afterwards -- a parcel is often posted a day before anyone updates the site.';

-- Answers "what is still sitting here", which is the question worth having an
-- index for. Orders that shipped are not the ones being chased.
create index if not exists orders_awaiting_shipment_idx
  on public.orders(paid_at) where shipped_at is null and paid_at is not null;
