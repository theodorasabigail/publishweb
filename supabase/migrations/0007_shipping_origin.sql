-- ===========================================================================
-- Publish Coffee Roasters -- where parcels ship from
--
-- Flat-rate zones never needed this: the rate was the same wherever the
-- roastery was. Any live-rate courier API does, because a rate is a function
-- of origin as well as destination.
--
-- It lives in site_settings so the operator can correct it in the admin after
-- a move, rather than it being a hard-coded constant nobody remembers.
--
-- Run this in Supabase -> SQL Editor, after 0006.
-- ===========================================================================

alter table public.site_settings
  add column if not exists origin_contact_name text,
  add column if not exists origin_phone text,
  add column if not exists origin_address text,
  add column if not exists origin_city text,
  add column if not exists origin_province text,
  add column if not exists origin_postal_code text,
  -- Couriers and aggregators identify pickup points differently: some want a
  -- postal code, some their own area id, some coordinates. Kept as free text
  -- so a provider can use whatever it needs without another migration.
  add column if not exists origin_area_code text,
  add column if not exists origin_note text;

comment on column public.site_settings.origin_area_code is
  'Provider-specific pickup area identifier, if the courier API needs one.';
