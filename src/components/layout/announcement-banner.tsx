import Link from "next/link";
import type { SiteSettings } from "@/lib/types";

/** The top announcement strip. Content, link and on/off all come from the
 *  admin's presentation controls (spec §7.2). */
export function AnnouncementBanner({ settings }: { settings: SiteSettings }) {
  if (!settings.banner_enabled || !settings.banner_text) return null;

  const content = (
    <div
      className="bg-bark-900 bg-cover bg-center py-2.5 text-center text-sm text-cream"
      style={
        settings.banner_image
          ? { backgroundImage: `linear-gradient(rgba(43,28,22,0.75), rgba(43,28,22,0.75)), url(${settings.banner_image})` }
          : undefined
      }
    >
      <span className="container-page block">{settings.banner_text}</span>
    </div>
  );

  if (!settings.banner_link) return content;

  return (
    <Link href={settings.banner_link} className="block hover:opacity-95">
      {content}
    </Link>
  );
}
