-- ===========================================================================
-- Publish Coffee Roasters -- the real roast list
--
-- Ebi's actual catalogue, from the price sheet: 17 coffees across five
-- origins, in whatever pack sizes each one is offered in. Only possible after
-- 0010 made `size` free text -- this list uses 15g, 45g, 75g, 150g, 300g and
-- 1kg, none of which the old enum allowed.
--
-- The regions on the price sheet -- Jawa Timur, Jawa Barat, Africa, Sumatra,
-- Latin America -- are recorded as each product's ORIGIN, not as categories.
-- They describe where a coffee is from, which is a fact about the coffee;
-- categories are how the shop chooses to group things for a visitor, and that
-- is a separate decision the operator should make later in the admin.
--
-- Every insert is `on conflict (slug) do nothing`, so running this twice adds
-- nothing and, more importantly, never overwrites a price edited in the admin
-- after the fact. To genuinely reset one, delete it in the admin first.
--
-- Prices are exactly as supplied. Stock is 0 -- nothing is sellable until it
-- is counted in, which is the honest starting state for a roastery.
--
-- Run this in Supabase -> SQL Editor, after 0010.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Retire the demo coffees.
--
-- Deactivated rather than deleted: any of them may already be attached to a
-- test order, and an order must never lose the product it was for. They vanish
-- from the shop and stay visible in the admin, where they can be deleted by
-- hand once the operator is sure.
-- --------------------------------------------------------------------------
update public.products
set is_active = false, is_featured = false
where slug in (
  'gayo-arunika', 'kintamani-lestari', 'toraja-sapan', 'terbit-blend', 'malam-decaf'
);

-- --------------------------------------------------------------------------
-- The coffees.
-- --------------------------------------------------------------------------
insert into public.products
  (slug, name, origin, process, varietal, accent_color, is_active, is_featured, sort_order)
values
  -- Jawa Timur
  ('mami-estate-waved-natural-komasti', 'Mami Estate Waved Natural Komasti',
   'Jawa Timur', 'Waved Natural', 'Komasti', '#486b73', true, true, 1),
  ('mami-estate-natural-komasti', 'Mami Estate Natural Komasti',
   'Jawa Timur', 'Natural', 'Komasti', '#486b73', true, false, 2),

  -- Jawa Barat
  ('palintang-washed-java-ateng', 'Palintang Washed Java Ateng',
   'Jawa Barat', 'Washed', 'Java Ateng', '#638c97', true, false, 3),
  ('genteng-sumedang-anaerobic-natural', 'Genteng Sumedang Anaerobic Natural Mixed Varieties',
   'Jawa Barat', 'Anaerobic Natural', 'Mixed Varieties', '#638c97', true, false, 4),
  ('mt-patuha-red-honey', 'Mt. Patuha Red Honey Mixed Varieties',
   'Jawa Barat', 'Red Honey', 'Mixed Varieties', '#638c97', true, true, 5),
  ('patuha-natural-typica', 'Patuha Natural Typica',
   'Jawa Barat', 'Natural', 'Typica', '#638c97', true, false, 6),
  ('kamojang-anaerobic-washed', 'Kamojang Anaerobic Washed',
   'Jawa Barat', 'Anaerobic Washed', null, '#638c97', true, false, 7),
  ('kertasari-natural-java', 'Kertasari Natural Java',
   'Jawa Barat', 'Natural', 'Java', '#638c97', true, false, 8),
  ('sukawangi-sumedang-natural-excelsa', 'Sukawangi Sumedang Natural Excelsa',
   'Jawa Barat', 'Natural', 'Excelsa', '#638c97', true, false, 9),
  ('puntang-extended-natural', 'Puntang Extended Natural Mixed Varieties',
   'Jawa Barat', 'Extended Natural', 'Mixed Varieties', '#638c97', true, false, 10),

  -- Africa
  ('ethiopia-bensa-daye-mountain-decaf', 'Ethiopia Bensa Daye Mountain Decaf Washed',
   'Africa', 'Washed Decaf', null, '#a7a4b5', true, false, 11),

  -- Sumatra
  ('aceh-bener-meriah-anaerobic-natural-gayo-1', 'Aceh Bener Meriah Anaerobic Natural Gayo 1',
   'Sumatra', 'Anaerobic Natural', 'Gayo 1', '#dab0b0', true, true, 12),

  -- Latin America
  ('panama-totumas-typica-washed', 'Panama Totumas Typica Washed',
   'Latin America', 'Washed', 'Typica', '#ee8a7a', true, false, 13),
  ('ecuador-sidra-anaerobic-washed', 'Ecuador Sidra Anaerobic Washed',
   'Latin America', 'Anaerobic Washed', 'Sidra', '#ee8a7a', true, false, 14),
  ('ecuador-sidra-anaerobic-honey-co2', 'Ecuador Sidra Anaerobic Honey CO2',
   'Latin America', 'Anaerobic Honey CO2', 'Sidra', '#ee8a7a', true, false, 15),
  ('hacienda-la-papaya-b7-anaerobic-120hr', 'Hacienda La Papaya B7 Anaerobic 120HR',
   'Latin America', 'Anaerobic 120HR', 'B7', '#ee8a7a', true, false, 16)
on conflict (slug) do nothing;

-- --------------------------------------------------------------------------
-- Pack sizes and prices.
--
-- Only the sizes each coffee is actually offered in: the price sheet has gaps,
-- and a gap means "we do not sell that size", not "price it at zero".
--
-- Shipping weight is the pack plus its packaging -- proportionally heavier on
-- the small sample sizes, where a 15 g bag is mostly bag.
-- --------------------------------------------------------------------------
insert into public.product_variants (product_id, size, price_idr, stock, weight_grams, is_active)
select p.id, v.size, v.price_idr, 0, v.weight_grams, true
from (values
  -- Jawa Timur
  ('mami-estate-waved-natural-komasti', '75gr',  105000, 110),
  ('mami-estate-waved-natural-komasti', '150gr', 185000, 190),
  ('mami-estate-waved-natural-komasti', '300gr', 350000, 350),
  ('mami-estate-natural-komasti',       '75gr',  105000, 110),
  ('mami-estate-natural-komasti',       '150gr', 185000, 190),
  ('mami-estate-natural-komasti',       '300gr', 350000, 350),

  -- Jawa Barat
  ('palintang-washed-java-ateng',        '75gr',   75000, 110),
  ('palintang-washed-java-ateng',        '150gr', 140000, 190),
  ('palintang-washed-java-ateng',        '300gr', 250000, 350),
  ('genteng-sumedang-anaerobic-natural', '75gr',   82500, 110),
  ('genteng-sumedang-anaerobic-natural', '150gr', 150000, 190),
  ('genteng-sumedang-anaerobic-natural', '300gr', 285000, 350),
  ('mt-patuha-red-honey',                '75gr',   88000, 110),
  ('mt-patuha-red-honey',                '150gr', 165000, 190),
  ('mt-patuha-red-honey',                '300gr', 304000, 350),
  ('patuha-natural-typica',              '75gr',   90750, 110),
  ('patuha-natural-typica',              '150gr', 175000, 190),
  ('patuha-natural-typica',              '300gr', 332500, 350),
  ('kamojang-anaerobic-washed',          '75gr',   95000, 110),
  ('kamojang-anaerobic-washed',          '150gr', 160000, 190),
  ('kamojang-anaerobic-washed',          '300gr', 300000, 350),
  ('kertasari-natural-java',             '75gr',   96250, 110),
  ('kertasari-natural-java',             '150gr', 180000, 190),
  ('kertasari-natural-java',             '300gr', 342000, 350),
  ('sukawangi-sumedang-natural-excelsa', '75gr',  104500, 110),
  ('sukawangi-sumedang-natural-excelsa', '150gr', 175000, 190),
  ('sukawangi-sumedang-natural-excelsa', '300gr', 345000, 350),
  ('puntang-extended-natural',           '75gr',  108000, 110),
  ('puntang-extended-natural',           '150gr', 180000, 190),
  ('puntang-extended-natural',           '300gr', 322000, 350),

  -- Africa
  ('ethiopia-bensa-daye-mountain-decaf', '15gr',   82500,  45),
  ('ethiopia-bensa-daye-mountain-decaf', '45gr',  190000,  80),
  ('ethiopia-bensa-daye-mountain-decaf', '75gr',  295000, 110),

  -- Sumatra
  ('aceh-bener-meriah-anaerobic-natural-gayo-1', '75gr',   82500,  110),
  ('aceh-bener-meriah-anaerobic-natural-gayo-1', '150gr', 150000,  190),
  ('aceh-bener-meriah-anaerobic-natural-gayo-1', '300gr', 285000,  350),
  ('aceh-bener-meriah-anaerobic-natural-gayo-1', '1KG',   375000, 1100),

  -- Latin America
  ('panama-totumas-typica-washed',          '15gr', 140000,  45),
  ('ecuador-sidra-anaerobic-washed',        '15gr',  75000,  45),
  ('ecuador-sidra-anaerobic-washed',        '45gr', 170000,  80),
  ('ecuador-sidra-anaerobic-washed',        '75gr', 250000, 110),
  ('ecuador-sidra-anaerobic-honey-co2',     '15gr',  80000,  45),
  ('ecuador-sidra-anaerobic-honey-co2',     '45gr', 180000,  80),
  ('ecuador-sidra-anaerobic-honey-co2',     '75gr', 250000, 110),
  ('hacienda-la-papaya-b7-anaerobic-120hr', '15gr',  88000,  45),
  ('hacienda-la-papaya-b7-anaerobic-120hr', '45gr', 200000,  80),
  ('hacienda-la-papaya-b7-anaerobic-120hr', '75gr', 315000, 110)
) as v(product_slug, size, price_idr, weight_grams)
join public.products p on p.slug = v.product_slug
on conflict (product_id, size) do nothing;
