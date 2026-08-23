-- ===========================================================================
-- Publish Coffee Roasters -- addresses shaped like Indonesian addresses
--
-- The address fields were the generic western set: line1, line2, city,
-- province, postal code. An Indonesian address has two more levels between the
-- street and the city -- kecamatan and kelurahan -- and they are not optional
-- detail. A courier needs them, and leaving them out means people cram the
-- whole address into one box, which is exactly what has been happening.
--
-- `area_id` is Biteship's own key for a place. Rates can be asked for by
-- destination_area_id instead of destination_postal_code, which is both more
-- precise and what booking a courier actually needs -- so storing it is what
-- turns the courier integration from a quote into a shipment.
--
-- Every column is nullable. Addresses already saved are still valid addresses;
-- they simply have less detail than new ones, and nothing should stop a
-- customer reordering to one.
--
-- Run this in Supabase -> SQL Editor, after 0025.
-- ===========================================================================

alter table public.addresses
  -- Kelurahan or desa.
  add column if not exists village text,
  -- Kecamatan.
  add column if not exists district text,
  add column if not exists area_id text;

comment on column public.addresses.village is 'Kelurahan or desa.';
comment on column public.addresses.district is 'Kecamatan.';
comment on column public.addresses.area_id is
  'Biteship''s identifier for this place. Present when the address was chosen from the area lookup rather than typed, and preferred over the postal code when asking for rates.';

-- The order's own copy is a jsonb snapshot rather than columns, so it needs no
-- migration -- new orders simply carry the extra keys. Nothing reads a key it
-- has not been given, so old orders keep rendering exactly as before.
