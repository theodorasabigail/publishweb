-- ===========================================================================
-- Publish Coffee Roasters -- every page becomes an editable page
--
-- Until now there were two kinds of page. Custom ones lived in `pages` and
-- were entirely the operator's. Built-in ones -- the homepage, the shop, the
-- journal, jasa roasting, about -- were code: their headings and intro
-- paragraphs were written into components, and blocks could only be added
-- *underneath* whatever was already there.
--
-- That split is the reason two different requests both had no good answer:
-- "let the blocks replace what is there" and "let me rewrite the wording on
-- the journal and the roasting page". Both are the same missing idea, which is
-- that a built-in page should be a row like any other.
--
-- So the built-in pages get rows. They carry:
--   heading / intro   wording that overrides what the component ships with
--   blocks_mode       whether blocks go underneath the page or replace it
--   show_in_nav       and nav_order, which now drive the actual top menu
--
-- Nothing is destructive: every override is nullable and falls back to the
-- built-in copy, so a page nobody edits looks exactly as it does today.
--
-- Run this in Supabase -> SQL Editor, after 0017.
-- ===========================================================================

alter table public.pages
  -- Built-in pages answer at their own route; custom ones at /p/<slug>.
  add column if not exists href text,
  -- True for the five below. Stops the admin offering to delete a page that is
  -- a route in the code and would simply come back.
  add column if not exists is_built_in boolean not null default false,
  -- 'append' keeps the page and puts blocks after it. 'replace' hands the
  -- whole page to the blocks.
  add column if not exists blocks_mode text not null default 'append',
  -- Wording overrides. Null means "use what the page ships with", so clearing
  -- a field restores the original rather than emptying the page.
  add column if not exists heading text,
  add column if not exists intro text;

do $$ begin
  alter table public.pages
    add constraint pages_blocks_mode_valid
    check (blocks_mode in ('append', 'replace'));
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------------------
-- The built-in pages, as rows.
--
-- `on conflict do nothing` so re-running never resets a renamed menu item or a
-- rewritten heading. The nav_order values leave gaps, so a custom page can be
-- slotted between two built-in ones without renumbering anything.
-- --------------------------------------------------------------------------
insert into public.pages (slug, title, href, is_built_in, is_published, show_in_nav, nav_order)
values
  ('home',     'Home',          '/',         true, true, false, 0),
  ('shop',     'Shop',          '/shop',     true, true, true,  10),
  ('roasting', 'Jasa Roasting', '/roasting', true, true, true,  20),
  ('blog',     'Journal',       '/blog',     true, true, true,  30),
  ('about',    'About',         '/about',    true, true, true,  40)
on conflict (slug) do nothing;

comment on column public.pages.blocks_mode is
  'append = blocks render under the built-in page. replace = blocks are the whole page.';
comment on column public.pages.heading is
  'Overrides the page''s own heading. Null uses the built-in wording.';
