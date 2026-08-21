-- ===========================================================================
-- Publish Coffee Roasters -- remove the demo coffees
--
-- Gayo Arunika, Kintamani Lestari, Toraja Sapan, Terbit Blend and Malam Decaf
-- were placeholders from before there was a real catalogue. 0003 no longer
-- creates them; this removes them from a database that already has them, so
-- the shop and the admin show only the actual lineup.
--
-- Deleted outright rather than hidden. Hidden products still fill the admin
-- list, still have to be read past, and are exactly the thing that makes an
-- operator unsure which rows are real -- which is the problem being solved.
--
-- Order history is unaffected, and that is by design rather than by luck:
-- order_items carry their own name, size and price snapshots, and their
-- foreign keys are `on delete set null` precisely so a discontinued coffee can
-- never rewrite or invalidate a receipt. A past order keeps saying exactly
-- what was bought and for how much.
--
-- Variants go with the product through `on delete cascade`.
--
-- Run this in Supabase -> SQL Editor, after 0016.
-- ===========================================================================

-- Clear them out of the homepage picker first. site_settings holds an array of
-- category ids, not product ids, so nothing to do there -- but the featured
-- post reference is the same shape of problem, and a product id lingering in a
-- settings array would survive the delete and point at nothing.
delete from public.products
where slug in (
  'gayo-arunika',
  'kintamani-lestari',
  'toraja-sapan',
  'terbit-blend',
  'malam-decaf'
);
