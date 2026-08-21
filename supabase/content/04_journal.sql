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

