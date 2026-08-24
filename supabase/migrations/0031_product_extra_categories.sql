-- ===========================================================================
-- Publish Coffee Roasters -- coffees that live in more than one category
--
-- `products.category_id` is a single foreign key, so a coffee could be in
-- Naturals *or* Java but not both. That is right for the primary label a
-- coffee shows on its card and for the URL it lives at -- one canonical answer
-- is what routing needs -- but many coffees genuinely belong on more than one
-- shelf: a natural Java is naturally on both.
--
-- `category_id` stays as the primary. Extras live in a small join table, and
-- the shop-by-category page reads the union. Existing coffees keep their
-- single home unchanged and appear nowhere new.
--
-- Run this in Supabase -> SQL Editor, after 0030.
-- ===========================================================================

create table if not exists public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (product_id, category_id)
);

comment on table public.product_categories is
  'Extra categories a coffee should also appear in. products.category_id remains the primary -- the one shown on the card and used for the URL. This is the "also appears in" set.';

-- Reading a category's products in one query means indexing the far side.
create index if not exists product_categories_category_idx
  on public.product_categories(category_id);

alter table public.product_categories enable row level security;

drop policy if exists "product_categories: public read" on public.product_categories;
create policy "product_categories: public read"
  on public.product_categories for select using (true);

drop policy if exists "product_categories: admin write" on public.product_categories;
create policy "product_categories: admin write"
  on public.product_categories for all
  using (public.is_admin()) with check (public.is_admin());
