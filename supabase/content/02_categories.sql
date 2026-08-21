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

