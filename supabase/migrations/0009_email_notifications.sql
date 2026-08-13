-- ===========================================================================
-- Publish Coffee Roasters -- transactional email bookkeeping
--
-- Two markers on orders so an email is sent exactly once.
--
-- Payment webhooks retry: Xendit and Moota both redeliver until they get a
-- 200, and mark_order_paid is idempotent precisely so that is safe. Sending
-- email is not idempotent -- a redelivery would put a second receipt in the
-- customer's inbox. These columns are claimed with a conditional update, so
-- the first delivery wins and every later one sends nothing.
--
-- Run this in Supabase -> SQL Editor, after 0008.
-- ===========================================================================

alter table public.orders
  add column if not exists confirmation_email_sent_at timestamptz,
  -- Stores the tracking number that was emailed, not just a timestamp. Saving
  -- the fulfilment form again must not re-notify, but correcting a tracking
  -- number that was typed wrong should -- the customer is holding a number
  -- that does not work.
  add column if not exists shipped_email_tracking text;

comment on column public.orders.confirmation_email_sent_at is
  'Set when the paid-order receipt was sent. Claimed atomically so a redelivered payment webhook cannot send twice.';

comment on column public.orders.shipped_email_tracking is
  'The tracking number the customer was last emailed. A different value means a correction worth re-sending.';
