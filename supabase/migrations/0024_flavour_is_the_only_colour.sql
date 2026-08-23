-- ===========================================================================
-- Publish Coffee Roasters -- one colour system for coffee, not two
--
-- A product carried two colours: `accent_color`, an arbitrary per-product
-- value from the original spec, and its flavour level, which is Publish's own
-- six-step scale and is printed on the bags.
--
-- 0013 already made the flavour colour win wherever both existed, which left
-- accent_color as a fallback nobody could see the effect of and a second
-- colour picker in the product form that changed nothing on most products.
-- A setting that usually does nothing is worse than no setting: the operator
-- cannot tell whether it is broken or working.
--
-- So the arbitrary one goes. What a coffee looks like now follows from what it
-- tastes like, which is the only version of this that can stay in step with
-- the packaging.
--
-- Blog categories keep their own accent colour. A journal category is not a
-- coffee and has no flavour, so the scale has nothing to say about it.
--
-- Run this in Supabase -> SQL Editor, after 0023.
-- ===========================================================================

alter table public.products
  drop column if exists accent_color;
