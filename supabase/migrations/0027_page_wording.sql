-- ===========================================================================
-- Publish Coffee Roasters -- wording that lives in the database, not the code
--
-- 0018 made a page's heading and intro editable, which covered the top of the
-- page and nothing else. Everything further down -- the four steps on the
-- roasting page, the labels inside the quote form, the button on it -- was
-- still English written into a component, so an operator who wanted "Nama
-- lengkap" instead of "Your name" needed a developer and a deployment.
--
-- One jsonb map of overrides rather than a column per phrase. A phrase is not
-- a field: which phrases exist changes whenever a page is redesigned, and a
-- column per phrase would mean a migration every time somebody rewords a
-- button. Absent keys fall through to what the component ships with, so a page
-- nobody has edited reads exactly as it does today.
--
-- Run this in Supabase -> SQL Editor, after 0026.
-- ===========================================================================

alter table public.pages
  add column if not exists copy jsonb not null default '{}'::jsonb;

comment on column public.pages.copy is
  'Wording overrides, keyed by slot. A missing or blank key uses the text the page ships with, so this is always additive and never leaves a page with an empty label.';
