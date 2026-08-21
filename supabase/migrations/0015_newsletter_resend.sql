-- ===========================================================================
-- Publish Coffee Roasters -- connecting the mailing list to Resend
--
-- The list itself stays in newsletter_subscribers. This only records which
-- Resend audience it is mirrored into, so the operator never has to paste an
-- identifier into Vercel and redeploy for something they set up by pressing a
-- button in the dashboard.
--
-- Also records when each subscriber was last pushed across, so a re-sync can
-- send only what is new rather than the whole list every time.
--
-- Run this in Supabase -> SQL Editor, after 0014.
-- ===========================================================================

alter table public.site_settings
  add column if not exists resend_audience_id text;

comment on column public.site_settings.resend_audience_id is
  'Resend audience the mailing list is mirrored into. Set from Admin -> Customers -> Mailing list.';

alter table public.newsletter_subscribers
  add column if not exists synced_at timestamptz;

create index if not exists newsletter_unsynced_idx
  on public.newsletter_subscribers(synced_at) where synced_at is null;
