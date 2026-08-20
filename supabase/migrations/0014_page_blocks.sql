-- ===========================================================================
-- Publish Coffee Roasters -- page blocks
--
-- Sections of a page the operator can add, remove and reorder without code.
--
-- Deliberately NOT a general page builder. A builder that can express any
-- layout can also express a broken one, and the person using this is not going
-- to debug a collapsed flexbox at midnight. So there are a fixed number of
-- block types, each one a layout that is already designed, already responsive
-- and already correct at every width. The operator chooses which blocks and in
-- what order; they cannot choose a bad arrangement, because bad arrangements
-- are not among the options.
--
-- `content` is jsonb rather than columns because the fields differ per type --
-- a split needs an image side, a statement does not -- and a table with thirty
-- mostly-null columns would be worse. The shapes are defined and validated in
-- src/lib/blocks.ts, which is the contract.
--
-- Run this in Supabase -> SQL Editor, after 0013.
-- ===========================================================================

create table if not exists public.page_blocks (
  id uuid primary key default gen_random_uuid(),
  -- Which page this belongs to: 'home', 'about', or the slug of a custom page
  -- rendered at /p/<slug>.
  page text not null,
  block_type text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists page_blocks_page_idx
  on public.page_blocks(page, sort_order);

alter table public.page_blocks enable row level security;

-- Anyone may read an active block: these are the public page. Only admins
-- write. Matching the products policy rather than inventing a new shape.
drop policy if exists "page_blocks: public read active" on public.page_blocks;
create policy "page_blocks: public read active" on public.page_blocks
  for select using (is_active);

drop policy if exists "page_blocks: admin all" on public.page_blocks;
create policy "page_blocks: admin all" on public.page_blocks
  for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- Custom pages.
--
-- A block needs somewhere to live. 'home' and 'about' already have somewhere;
-- anything else needs a title, a slug and a switch, so this is the index of
-- pages that exist at /p/<slug>.
-- --------------------------------------------------------------------------
create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  seo_title text,
  seo_description text,
  is_published boolean not null default false,
  -- Optional: show it in the main menu, and where.
  show_in_nav boolean not null default false,
  nav_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pages_nav_idx
  on public.pages(show_in_nav, nav_order) where is_published;

alter table public.pages enable row level security;

drop policy if exists "pages: public read published" on public.pages;
create policy "pages: public read published" on public.pages
  for select using (is_published);

drop policy if exists "pages: admin all" on public.pages;
create policy "pages: admin all" on public.pages
  for all using (public.is_admin()) with check (public.is_admin());

comment on table public.page_blocks is
  'Operator-arranged page sections. Block shapes are defined in src/lib/blocks.ts.';
