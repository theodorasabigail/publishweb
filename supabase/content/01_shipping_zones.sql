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

