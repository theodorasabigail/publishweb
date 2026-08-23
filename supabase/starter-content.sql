-- ===========================================================================
-- Publish Coffee Roasters -- starting content
-- PT Aroma Pulau Arunika
--
-- THIS FILE IS GENERATED. Do not edit it by hand.
-- Edit supabase/content/*.sql instead, then run: npm run build:sql
--
-- ---------------------------------------------------------------------------
-- RUN THIS ONCE, ON A BRAND-NEW PROJECT, AFTER setup.sql
--
-- It adds the starting coffees, shipping rates, categories and sample journal
-- posts, so a new shop is not an empty one.
--
-- ---------------------------------------------------------------------------
-- DO NOT RUN IT AGAIN
--
-- Every statement here skips rows that already exist, so re-running will not
-- overwrite a price or a heading you have changed. But it WILL bring back a
-- coffee you deliberately deleted, because from its point of view a missing
-- row is a row it has not added yet.
--
-- If you want to update your database, use supabase/setup.sql. That one is
-- built to be run over and over.
-- ===========================================================================

-- ===========================================================================
-- content/01_shipping_zones.sql
-- ===========================================================================

-- ===========================================================================
-- Starting shipping rates
--
-- Seven zones covering Indonesia and the rest of the world. Every figure is
-- editable in Admin -> Site settings -> Shipping rates, and this file is run
-- once and never again, so nothing here can overwrite a rate you have tuned.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Shipping zones (flat rate, v1). Rates are padded on purpose -- see docs.
-- --------------------------------------------------------------------------
insert into public.shipping_zones
  (code, name, country_codes, is_domestic, base_rate_idr, threshold_grams, heavy_rate_idr, free_shipping_over_idr, delivery_estimate, sort_order)
values
  ('id-jawa',    'Indonesia — Jawa',        array['ID'], true,   18000, 1000,  30000, 500000, '1–3 hari kerja',  1),
  ('id-luar',    'Indonesia — luar Jawa',   array['ID'], true,   32000, 1000,  55000, 750000, '2–6 hari kerja',  2),
  ('sea',        'Southeast Asia',          array['SG','MY','TH','VN','PH','BN','KH','LA','MM'], false, 180000, 1000, 300000, null, '5–10 business days', 3),
  ('apac',       'Asia-Pacific',            array['AU','NZ','JP','KR','TW','HK','CN','IN'],      false, 260000, 1000, 420000, null, '7–14 business days', 4),
  ('europe',     'Europe & UK',             array['GB','IE','DE','FR','NL','BE','ES','IT','PT','SE','NO','DK','FI','PL','CH','AT','CZ'], false, 340000, 1000, 540000, null, '8–16 business days', 5),
  ('north-america', 'North America',        array['US','CA','MX'], false, 360000, 1000, 570000, null, '8–16 business days', 6),
  ('rest',       'Rest of world',           array[]::text[],       false, 420000, 1000, 660000, null, '10–21 business days', 7)
on conflict (code) do nothing;

-- ===========================================================================
-- content/02_categories.sql
-- ===========================================================================

-- ===========================================================================
-- Starting categories
--
-- Ways of grouping coffee for a visitor. Publish's real lineup is organised
-- by origin instead, so these are a starting point rather than a requirement
-- -- delete any that are not useful in Admin -> Categories.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Product categories
-- --------------------------------------------------------------------------
insert into public.categories (slug, name, description, show_on_homepage, sort_order)
values
  ('single-origin', 'Single Origin', 'One farm, one lot, one story. Rotating micro-lots from across the archipelago.', true, 1),
  ('house-blend', 'House Blends', 'Built for milk, built for repeatability. The bags we drink every morning.', true, 2),
  ('filter', 'Filter Roast', 'Lighter, brighter, developed for pourover and immersion.', true, 3),
  ('espresso', 'Espresso Roast', 'Sweet, dense, forgiving under pressure.', true, 4)
on conflict (slug) do nothing;

-- ===========================================================================
-- content/03_catalogue.sql
-- ===========================================================================

-- ===========================================================================
-- Publish Coffee Roasters -- the real roast list
--
-- Ebi's actual catalogue, from the price sheet: 16 coffees across five
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
-- The coffees.
-- --------------------------------------------------------------------------
insert into public.products
  (slug, name, origin, process, varietal, is_active, is_featured, sort_order)
values
  -- Jawa Timur
  ('mami-estate-waved-natural-komasti', 'Mami Estate Waved Natural Komasti',
   'Jawa Timur', 'Waved Natural', 'Komasti', true, true, 1),
  -- Jawa Barat
  ('palintang-washed-java-ateng', 'Palintang Washed Java Ateng',
   'Jawa Barat', 'Washed', 'Java Ateng', true, false, 3),
  ('genteng-sumedang-anaerobic-natural', 'Genteng Sumedang Anaerobic Natural Mixed Varieties',
   'Jawa Barat', 'Anaerobic Natural', 'Mixed Varieties', true, false, 4),
  ('mt-patuha-red-honey', 'Mt. Patuha Red Honey Mixed Varieties',
   'Jawa Barat', 'Red Honey', 'Mixed Varieties', true, true, 5),
  ('patuha-natural-typica', 'Patuha Natural Typica',
   'Jawa Barat', 'Natural', 'Typica', true, false, 6),
  ('kamojang-anaerobic-washed', 'Kamojang Anaerobic Washed',
   'Jawa Barat', 'Anaerobic Washed', null, true, false, 7),
  ('kertasari-natural-java', 'Kertasari Natural Java',
   'Jawa Barat', 'Natural', 'Java', true, false, 8),
  ('sukawangi-sumedang-natural-excelsa', 'Sukawangi Sumedang Natural Excelsa',
   'Jawa Barat', 'Natural', 'Excelsa', true, false, 9),
  ('puntang-extended-natural', 'Puntang Extended Natural Mixed Varieties',
   'Jawa Barat', 'Extended Natural', 'Mixed Varieties', true, false, 10),

  -- Africa
  ('ethiopia-bensa-daye-mountain-decaf', 'Ethiopia Bensa Daye Mountain Decaf Washed',
   'Africa', 'Washed Decaf', null, true, false, 11),

  -- Sumatra
  ('aceh-bener-meriah-anaerobic-natural-gayo-1', 'Aceh Bener Meriah Anaerobic Natural Gayo 1',
   'Sumatra', 'Anaerobic Natural', 'Gayo 1', true, true, 12),

  -- Latin America
  ('panama-totumas-typica-washed', 'Panama Totumas Typica Washed',
   'Latin America', 'Washed', 'Typica', true, false, 13),
  ('ecuador-sidra-anaerobic-washed', 'Ecuador Sidra Anaerobic Washed',
   'Latin America', 'Anaerobic Washed', 'Sidra', true, false, 14),
  ('ecuador-sidra-anaerobic-honey-co2', 'Ecuador Sidra Anaerobic Honey CO2',
   'Latin America', 'Anaerobic Honey CO2', 'Sidra', true, false, 15),
  ('hacienda-la-papaya-b7-anaerobic-120hr', 'Hacienda La Papaya B7 Anaerobic 120HR',
   'Latin America', 'Anaerobic 120HR', 'B7', true, false, 16)
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

-- ===========================================================================
-- content/04_journal.sql
-- ===========================================================================

-- ===========================================================================
-- Starting journal sections and posts
--
-- Three sample posts, so the journal is not an empty page on day one. They
-- are written to be replaced: delete them in Admin -> Journal once there is
-- real writing to put there.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Blog
-- --------------------------------------------------------------------------
insert into public.blog_categories (slug, name, description, accent_color, sort_order)
values
  ('roasting-notes', 'Roasting Notes', 'What came off the drum this week, and why it tastes the way it does.', '#486b73', 1),
  ('origin', 'Origin', 'Farms, washing stations, and the people we buy from.', '#638c97', 2),
  ('brewing', 'Brewing', 'Recipes, ratios, and arguments about water.', '#dab0b0', 3),
  ('shop-journal', 'Shop Journal', 'Everything else that happens in a roastery.', '#486b73', 4)
on conflict (slug) do nothing;

insert into public.blog_posts
  (slug, title, excerpt, body, author_name, blog_category_id, tags, status, is_featured, published_at)
values
  ('why-we-wet-hull',
   'Why we still wet-hull',
   'Wet-hulling is the process most likely to get a Sumatran coffee disqualified from a cupping table. We keep buying it anyway.',
   E'Wet-hulling — *giling basah* — is the process most likely to get a Sumatran coffee thrown out of a specialty cupping table. The parchment comes off at a much higher moisture content than anywhere else in the world, the beans go a strange jade colour, and the resulting cup rarely does the bright, clean, fruit-forward thing that scores well.\n\nWe keep buying it anyway.\n\n## What actually happens\n\nIn a washed process, coffee dries inside its parchment down to about 11% moisture before hulling. In Aceh, the parchment is stripped at somewhere between 30 and 50%. The bean is soft. It deforms. It picks up the character of everything around it while it finishes drying in the open.\n\nThat is the whole argument against it, and it is a fair one. It is also the entire reason the coffee tastes like cedar and dark chocolate and old bookshelves instead of like every other washed coffee on the shelf.\n\n## The roasting problem\n\nA wet-hulled lot arrives less dense and less uniform than a washed one. Push it the way you would push a Kenyan and you get scorched tips and a hollow middle. We take the charge temperature down, stretch the Maillard phase, and drop about forty seconds past first crack.\n\nThe goal is not to make it taste clean. The goal is to make it taste like the best possible version of what it already is.',
   'Ebi', (select id from public.blog_categories where slug = 'roasting-notes'),
   array['sumatra','process','roasting'], 'published', true, now() - interval '6 days'),

  ('water-is-the-recipe',
   'Water is the recipe',
   'You can buy a better grinder or you can fix your water. One of those is Rp 8.000.',
   E'Every brewing guide starts with the grind. We would like to make a case for starting one step earlier.\n\nCoffee is about 98.5% water by weight. The mineral content of that water decides how much of the coffee actually dissolves, and in what order. Jakarta tap water, run through a basic filter jug, is usually too hard — it pulls the bitter compounds forward and flattens everything above them.\n\n## A starting point\n\nAim for roughly 70–100 ppm total dissolved solids, with the hardness sitting a little below the alkalinity. In practice, in Indonesia, that means:\n\n- Start with a low-mineral bottled water as your base\n- Cut it with a small amount of harder mineral water until the cup opens up\n- Keep the ratio written down, because you will forget it\n\nThat is the whole trick. Same beans, same grinder, same hands — a different cup.',
   'Ebi', (select id from public.blog_categories where slug = 'brewing'),
   array['brewing','water','pourover'], 'published', false, now() - interval '3 days'),

  ('kintamani-harvest-2026',
   'Notes from the Kintamani harvest',
   'Three days on the slopes of Batur with the growers behind the Lestari lot.',
   E'The road up to Kintamani is a series of switchbacks through citrus groves, which turns out to be relevant.\n\nCoffee here is almost never planted alone. It grows under and beside tangerine trees, and the growers we buy from will tell you plainly that the fruit trees are the reliable income and the coffee is the one that pays attention.\n\n## The washing station\n\nThe Lestari lot is fully washed and dried on raised beds, which is not the regional default. It takes longer and it costs more, and it is the reason the cup is as clean as it is.\n\nWe committed to the same lot for a third year running. Consistency is worth more to us than chasing a novel micro-lot every season.',
   'Ebi', (select id from public.blog_categories where slug = 'origin'),
   array['bali','origin','harvest'], 'published', false, now() - interval '1 day')
on conflict (slug) do nothing;

-- ===========================================================================
-- content/05_flavour_levels.sql
-- ===========================================================================

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

-- ===========================================================================
-- content/06_presentation.sql
-- ===========================================================================

-- ===========================================================================
-- Starting homepage presentation
--
-- Points the homepage at the categories and post seeded above. Guarded on
-- hero_subtitle being empty, so it only ever applies to a project nobody has
-- customised yet.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Homepage presentation defaults
-- --------------------------------------------------------------------------
update public.site_settings
   set hero_title = 'Coffee, published.',
       hero_subtitle = 'A small roastery in Indonesia. Rotating single origins, blends we actually drink, and a custom roasting service for your own green beans.',
       homepage_category_ids = array(
         select id from public.categories where show_on_homepage order by sort_order
       ),
       featured_post_id = (select id from public.blog_posts where slug = 'why-we-wet-hull'),
       seo_description = 'Small-batch Indonesian coffee roasters. Single origin, blends, and custom roasting from PT Aroma Pulau Arunika.',
       contact_email = 'halo@publishcoffee.com'
 -- Only seed these on a fresh project. Without this guard, re-running the
 -- setup file would reset a hero the operator had already rewritten.
 where id = true
   and hero_subtitle is null;
