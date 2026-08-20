-- ===========================================================================
-- Publish Coffee Roasters -- sizes the operator controls
--
-- `size` was an enum of exactly '100g', '200g' and '1kg', which meant adding a
-- 250g bag or a 12oz sample was a code change and a deployment. For a roastery
-- that is the wrong place to put that decision -- pack sizes change with the
-- lot, the season, and what the wholesale customer asks for.
--
-- So it becomes free text, and sorting moves onto weight_grams, which the
-- table already carries and which shipping already prices from. Sorting by a
-- real weight is also more correct than the old hard-coded list ever was: it
-- puts 250g between 200g and 1kg without anybody maintaining an order.
--
-- Existing rows are untouched -- '100g' as an enum value and '100g' as text
-- are the same three characters -- so nothing needs re-entering.
--
-- Run this in Supabase -> SQL Editor, after 0009.
-- ===========================================================================

alter table public.product_variants
  alter column size type text using size::text;

-- The old enum still backs nothing once the column is text. Dropped so a
-- future reader does not mistake it for the source of truth. Guarded, because
-- re-running a migration must never be the thing that breaks a database.
drop type if exists variant_size;

-- Shipping already reads weight_grams, but it defaulted to 0, and a 0 g
-- variant silently falls back to a 250 g assumption when a parcel is priced.
-- That was survivable with three fixed sizes whose weights were filled in by
-- the form; with sizes the operator invents, an unfilled weight is a real
-- possibility and a wrong shipping quote is a real cost.
alter table public.product_variants
  add constraint product_variants_weight_positive
  check (weight_grams > 0) not valid;

-- `not valid` above means existing rows are left alone rather than blocking
-- the migration; this fixes them, and then the constraint holds for everything
-- new. The estimate is the pack size plus packaging, matching what the admin
-- form has been defaulting to.
update public.product_variants
set weight_grams = case
  when size ilike '%1kg%' or size ilike '%1000g%' then 1100
  when size ilike '%500g%' then 550
  when size ilike '%250g%' then 290
  when size ilike '%200g%' then 240
  when size ilike '%100g%' then 130
  else 250
end
where weight_grams <= 0;

alter table public.product_variants
  validate constraint product_variants_weight_positive;

comment on column public.product_variants.size is
  'Free text, shown to the customer as-is. Ordering comes from weight_grams.';
