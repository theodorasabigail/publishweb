-- ===========================================================================
-- Publish Coffee Roasters -- the operator's own list of payment methods
--
-- "Paid" was one button and the method was always written as `manual_admin` --
-- fine when the site was the only path, useless once the shop takes payment
-- half a dozen different ways: cash, QRIS Shopee, QRIS BTN, transfer BCA, and
-- so on. Which one the money came through matters for reconciliation.
--
-- The list lives on site_settings so the operator maintains it themselves.
-- Starter values reflect what a shop that has not customised anything would
-- reach for; they are replaced the moment the operator saves the settings.
--
-- Run this in Supabase -> SQL Editor, after 0031.
-- ===========================================================================

alter table public.site_settings
  add column if not exists payment_methods text[] not null default array[
    'Cash', 'QRIS', 'Transfer BCA', 'Card'
  ]::text[];

comment on column public.site_settings.payment_methods is
  'The list the operator picks from when marking an order paid by hand. Free text: reads back on the receipt exactly as typed, so use names your bookkeeping will recognise.';
