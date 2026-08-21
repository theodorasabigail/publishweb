-- ===========================================================================
-- Publish Coffee Roasters -- corrections to the seeded catalogue
--
-- Two things 0011 and 0013 got wrong, confirmed by Ebi against the real
-- lineup. Both are already fixed for a fresh install; this exists for a
-- database that ran the earlier version.
--
-- Every statement here is conditional on the *specific wrong value*, not just
-- on the row. That matters because setup.sql gets re-run: an unconditional
-- update would quietly undo a deliberate change made in the admin every time
-- the file was pasted again. Written this way, a correction applies once and
-- then never touches the row again.
--
-- Run this in Supabase -> SQL Editor, after 0015.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- 1. Mami Estate Natural Komasti (the plain one) is not sold.
--
-- Only the Waved Natural is. The plain one was seeded from a price sheet row
-- that turned out not to be a live product.
--
-- Deleted only if nothing was ever ordered against it. If an order does exist
-- the product stays and is merely hidden, because deleting it would leave that
-- order pointing at nothing -- order_items keep their own snapshots, but a
-- reader following the link would find a hole where the coffee used to be.
-- --------------------------------------------------------------------------
update public.products
set is_active = false, is_featured = false
where slug = 'mami-estate-natural-komasti';

delete from public.products
where slug = 'mami-estate-natural-komasti'
  and not exists (
    select 1
    from public.order_items oi
    join public.product_variants pv on pv.id = oi.variant_id
    where pv.product_id = products.id
  )
  and not exists (
    select 1 from public.order_items oi where oi.product_id = products.id
  );

-- --------------------------------------------------------------------------
-- 2. Puntang Extended Natural is level 6, not 5.
--
-- It was never visible on the packaging artwork, so 0013 inferred it from the
-- process. Ebi confirmed purple. Guarded on the old value so a later change in
-- the admin is never overwritten by re-running this file.
-- --------------------------------------------------------------------------
update public.products
set flavour_level = 6
where slug = 'puntang-extended-natural'
  and flavour_level = 5;

-- --------------------------------------------------------------------------
-- 3. Sukawangi Sumedang Natural Excelsa belongs with the other three.
--
-- Ebi confirmed that Kertasari, Patuha (TRT) Typica, Sukawangi Sumedang
-- Excelsa and Genteng Anaerobic Natural all share one orange. 0013 split them
-- across levels 4 and 5, reading two different oranges off artwork that has
-- only one.
--
-- Only Sukawangi was on the wrong side of that split, so it is the only row
-- that needs moving. Guarded on the old value, so a later choice in the admin
-- survives re-running this file.
--
-- Mt. Patuha Red Honey is deliberately left at 4. It was not named in that
-- group, and a honey process genuinely sits between a washed and a natural --
-- which is what the lighter orange is for. Worth confirming.
-- --------------------------------------------------------------------------
update public.products
set flavour_level = 5
where slug = 'sukawangi-sumedang-natural-excelsa'
  and flavour_level = 4;
