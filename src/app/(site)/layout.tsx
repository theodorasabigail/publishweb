import { AnnouncementBanner } from "@/components/layout/announcement-banner";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getSiteSettings } from "@/lib/queries";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Deliberately does NOT read cookies or the session. Doing so would make
  // every page under this layout dynamic, costing a database round-trip per
  // view across the whole storefront. The header works out sign-in state on
  // the client instead.
  const settings = await getSiteSettings();

  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBanner settings={settings} />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter settings={settings} />
    </div>
  );
}
