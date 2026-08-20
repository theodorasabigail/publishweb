-- ===========================================================================
-- Publish Coffee Roasters -- editable coming-soon page
--
-- The pre-launch page had its wording hard-coded, which made the one page the
-- whole internet can currently see the only page the operator could not
-- change. Backwards.
--
-- Nullable with no defaults on purpose: null means "use what the page ships
-- with", so an operator who never opens the panel sees no change, and clearing
-- a field puts the original wording back rather than leaving a blank page.
--
-- Run this in Supabase -> SQL Editor, after 0011.
-- ===========================================================================

alter table public.site_settings
  add column if not exists coming_soon_eyebrow text,
  add column if not exists coming_soon_title text,
  add column if not exists coming_soon_body text,
  add column if not exists coming_soon_note text,
  add column if not exists coming_soon_contact_line text;

comment on column public.site_settings.coming_soon_title is
  'Pre-launch page wording. Null falls back to the built-in copy, so clearing a field restores it rather than emptying the page.';
