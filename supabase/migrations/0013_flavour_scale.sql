-- ===========================================================================
-- Publish Coffee Roasters -- the flavour colour scale
--
-- Publish's own six-colour system, the one printed on the bags. 1-5 run from
-- the cleanest, most delicate cups to the biggest; 6 is the heavily processed
-- lots, which sit off that line rather than further along it.
--
-- Only the level is stored. The colours and labels live in src/lib/flavour.ts,
-- because they are printed on packaging and a shop that could drift out of
-- step with the bag would be worse than no scale at all.
--
-- Run this in Supabase -> SQL Editor, after 0012.
-- ===========================================================================

alter table public.products
  add column if not exists flavour_level smallint
  check (flavour_level is null or flavour_level between 1 and 6);

comment on column public.products.flavour_level is
  'Publish flavour scale, 1 (delicate) to 5 (bold), 6 = heavily processed. Null = not yet assigned. Colours and labels are in src/lib/flavour.ts.';

create index if not exists products_flavour_level_idx
  on public.products(flavour_level) where flavour_level is not null;
