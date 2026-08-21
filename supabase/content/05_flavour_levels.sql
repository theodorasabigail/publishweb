-- ===========================================================================
-- Starting flavour colours
--
-- Read off the packaging artwork where it was legible, inferred from the
-- process where it was not. Only fills empty values, and this file runs once,
-- so a colour set in the admin is never overwritten.
-- ===========================================================================

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
  -- Ebi confirmed these four share one orange. This originally split them
  -- across levels 4 and 5, reading two different oranges off the artwork where
  -- there is only one.
  ('genteng-sumedang-anaerobic-natural',           5),
  ('patuha-natural-typica',                        5),
  ('kertasari-natural-java',                       5),
  ('sukawangi-sumedang-natural-excelsa',           5),
  -- Red Honey, and the only coffee still on the lighter orange. Not confirmed
  -- either way; grouped separately because a honey process sits between a
  -- washed and a natural, which is what level 4 is for.
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
