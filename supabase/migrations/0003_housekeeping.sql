-- ===========================================================================
-- Publish Coffee Roasters -- housekeeping
--
-- Removes placeholder coffees that earlier versions of this project created.
-- Nothing here creates anything, and the five names are hard-coded, so it can
-- only ever remove those exact rows and can never touch a real product.
--
-- Order history is safe: order_items carry their own name, size and price
-- snapshots and their foreign keys are `on delete set null`, precisely so a
-- discontinued coffee cannot rewrite a receipt.
--
-- Everything that used to live in this file -- shipping zones, categories,
-- sample posts, the catalogue -- moved to supabase/content/, which is run once
-- on a new project and never again. That is what makes re-running the setup
-- file provably unable to touch your products, prices or writing.
-- ===========================================================================

delete from public.products
where slug in (
  'gayo-arunika',
  'kintamani-lestari',
  'toraja-sapan',
  'terbit-blend',
  'malam-decaf',
  -- Seeded from a price-sheet row that turned out not to be a live product.
  'mami-estate-natural-komasti'
);
