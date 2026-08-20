-- ===========================================================================
-- Publish Coffee Roasters -- starter data
--
-- Safe to run on a fresh project. Everything here is editable later from the
-- Admin Dashboard; none of it needs to be changed in SQL.
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

-- --------------------------------------------------------------------------
-- Products + variants
-- --------------------------------------------------------------------------
with c as (select slug, id from public.categories)
insert into public.products
  (slug, name, description, origin, process, roast_level, varietal, masl, tasting_notes,
   category_id, accent_color, is_featured, sort_order)
values
  ('gayo-arunika', 'Gayo Arunika',
   'Our anchor lot from the Gayo highlands. Wet-hulled in the traditional Sumatran way, then roasted a touch past first crack to keep the body heavy and the finish clean.',
   'Aceh Tengah, Sumatra', 'Wet Hulled', 'Medium', 'Ateng, Timtim', '1400–1600',
   'Dark chocolate, cedar, brown sugar',
   (select id from c where slug = 'single-origin'), '#486b73', true, 1),

  ('kintamani-lestari', 'Kintamani Lestari',
   'Grown alongside citrus trees on the slopes of Mount Batur, which is exactly what it tastes like. Fully washed and dried on raised beds.',
   'Kintamani, Bali', 'Fully Washed', 'Light-Medium', 'Kartika, S795', '1200–1500',
   'Mandarin, jasmine, golden syrup',
   (select id from c where slug = 'filter'), '#dab0b0', true, 2),

  ('toraja-sapan', 'Toraja Sapan',
   'A high-grown Sulawesi lot with the structure to hold up in a long brew. Quiet acidity, long sweet finish.',
   'Tana Toraja, Sulawesi', 'Semi Washed', 'Medium', 'S795, Typica', '1500–1750',
   'Baking spice, dried fig, dark cocoa',
   (select id from c where slug = 'single-origin'), '#486b73', false, 3),

  ('terbit-blend', 'Terbit Blend',
   'Our everyday espresso. Sumatra for the body, Bali for the lift. Designed to taste like itself through a flat white.',
   'Blend — Sumatra & Bali', 'Blend', 'Medium-Dark', 'Various', '1200–1600',
   'Milk chocolate, toasted almond, red plum',
   (select id from c where slug = 'espresso'), '#638c97', true, 4),

  ('malam-decaf', 'Malam Decaf',
   'Sugarcane-process decaf from Java. For the second pot, the late shift, and everyone who wants the ritual without the rest of it.',
   'Java Barat', 'Sugarcane EA Decaf', 'Medium', 'Lini S', '1300–1500',
   'Cocoa nib, roasted hazelnut, raisin',
   (select id from c where slug = 'house-blend'), '#a7a4b5', false, 5)
on conflict (slug) do nothing;

insert into public.product_variants (product_id, size, price_idr, stock, weight_grams)
select p.id, v.size, v.price, v.stock, v.grams
from public.products p
cross join (values
  ('100g'::variant_size, 68000,  40, 130),
  ('200g'::variant_size, 125000, 30, 240),
  ('1kg'::variant_size,  560000, 12, 1100)
) as v(size, price, stock, grams)
where p.slug in ('gayo-arunika','kintamani-lestari','toraja-sapan','terbit-blend','malam-decaf')
on conflict (product_id, size) do nothing;

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
