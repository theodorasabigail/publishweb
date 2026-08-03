import { AnnouncementBanner } from "@/components/layout/announcement-banner";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { getSiteSettings } from "@/lib/queries";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();
  const session = isSupabaseConfigured() ? await getSession() : null;

  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBanner settings={settings} />
      <SiteHeader isSignedIn={Boolean(session)} />
      <main className="flex-1">{children}</main>
      <SiteFooter settings={settings} />
    </div>
  );
}
