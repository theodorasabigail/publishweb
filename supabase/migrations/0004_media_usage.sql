-- ===========================================================================
-- Publish Coffee Roasters -- media storage reporting
--
-- The free Supabase plan allows 1 GB of file storage and 5 GB of egress a
-- month. Two things quietly eat that: oversized originals (handled in the
-- browser, before upload) and files that stay in the bucket after the row
-- pointing at them has moved on. These functions make the second one visible
-- and fixable from the admin dashboard.
--
-- Run this in Supabase -> SQL Editor, after 0003.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Every image URL currently referenced by a row somewhere.
-- --------------------------------------------------------------------------
create or replace view public.referenced_media as
  select image_url as url from public.products where image_url is not null
  union
  select og_image_url from public.products where og_image_url is not null
  union
  select image_url from public.categories where image_url is not null
  union
  select cover_image from public.blog_posts where cover_image is not null
  union
  select og_image_url from public.blog_posts where og_image_url is not null
  union
  select hero_image from public.site_settings where hero_image is not null
  union
  select banner_image from public.site_settings where banner_image is not null
  union
  select og_image_url from public.site_settings where og_image_url is not null;

-- --------------------------------------------------------------------------
-- How much of the storage allowance is in use.
-- --------------------------------------------------------------------------
create or replace function public.media_storage_usage()
returns table (object_count bigint, total_bytes bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::bigint,
    coalesce(sum(coalesce((metadata ->> 'size')::bigint, 0)), 0)::bigint
  from storage.objects
  where bucket_id = 'media';
$$;

-- --------------------------------------------------------------------------
-- Files in the bucket that nothing points at any more -- usually a product
-- photo that was replaced, since a replacement uploads to a new path.
--
-- Anything uploaded in the last 24 hours is excluded on purpose: a file sits
-- in the bucket from the moment it uploads until the form around it is saved,
-- and that gap must never look like garbage.
-- --------------------------------------------------------------------------
create or replace function public.unused_media()
returns table (name text, size_bytes bigint, uploaded_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.name,
    coalesce((o.metadata ->> 'size')::bigint, 0)::bigint,
    o.created_at
  from storage.objects o
  where o.bucket_id = 'media'
    and o.created_at < now() - interval '24 hours'
    -- position() rather than LIKE: object names are not escaped, and a stray
    -- underscore or percent in a filename would otherwise match too broadly.
    and not exists (
      select 1 from public.referenced_media r
      where position(o.name in r.url) > 0
    )
  order by o.created_at;
$$;

-- These read across every table and bypass RLS, so only the server-side
-- service role may call them. The admin dashboard already runs as that role;
-- nothing in the browser can reach them.
revoke all on public.referenced_media from anon, authenticated;
revoke all on function public.media_storage_usage() from anon, authenticated;
revoke all on function public.unused_media() from anon, authenticated;
