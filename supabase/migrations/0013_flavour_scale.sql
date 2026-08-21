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

-- --------------------------------------------------------------------------
-- Starting assignments for the current lineup.
--
-- Read off the packaging artwork. Where a coffee was legible there its colour
-- is used directly; where it was not, the level is inferred from the process
-- in its name, which is the same signal the artwork encodes. Those inferences
-- are marked, and all of it is editable in the admin -- this is a starting
-- point so nothing launches uncoloured, not a decision.
--
-- Only fills empty values, so re-running never overwrites a correction.
-- --------------------------------------------------------------------------
update public.products p
set flavour_level = v.level
from (values
  -- Read directly from the artwork
  ('mami-estate-waved-natural-komasti',            1),  -- white
  ('ethiopia-bensa-daye-mountain-decaf',           1),  -- white
  ('ecuador-sidra-anaerobic-washed',               1),  -- white
  ('palintang-washed-java-ateng',                  2),  -- pale yellow
  ('kamojang-anaerobic-washed',                    2),  -- pale yellow
  -- Ebi confirmed these four share one colour, described as "dark green" --
  -- which is not one of the six swatches supplied, so the level below is a
  -- placeholder. What is certain is that they are the SAME level as each
  -- other; 0013 originally split them across 4 and 5, which was wrong.
  ('genteng-sumedang-anaerobic-natural',           5),
  ('patuha-natural-typica',                        5),
  ('kertasari-natural-java',                       5),
  ('sukawangi-sumedang-natural-excelsa',           5),
  -- Not mentioned either way; still read as orange from the artwork.
  ('mt-patuha-red-honey',                          4),
  ('aceh-bener-meriah-anaerobic-natural-gayo-1',   6),  -- purple
  ('ecuador-sidra-anaerobic-honey-co2',            6),  -- purple
  ('hacienda-la-papaya-b7-anaerobic-120hr',        6),  -- purple

  -- Not on the artwork. Puntang was confirmed by Ebi directly; Panama is
  -- still inferred from the process and worth a look.
  ('puntang-extended-natural',                     6),
  ('panama-totumas-typica-washed',                 1)
) as v(slug, level)
where p.slug = v.slug
  and p.flavour_level is null;
