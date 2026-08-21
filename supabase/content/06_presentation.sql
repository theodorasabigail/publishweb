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
