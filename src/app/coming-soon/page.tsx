import type { Metadata } from "next";
import Image from "next/image";
import { Instagram, Mail, MessageCircle } from "lucide-react";
import { NewsletterSignup } from "@/components/layout/newsletter-signup";
import { getSiteSettings } from "@/lib/queries";
import { COMING_SOON_DEFAULTS } from "@/lib/coming-soon";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Coming soon",
  description:
    "Publish Coffee Roasters — small-batch Indonesian coffee, opening soon.",
  // Kept out of search results on purpose. A coming-soon page is not what
  // should be indexed and then have to be displaced later.
  robots: { index: false, follow: false },
};

export default async function ComingSoonPage() {
  const settings = await getSiteSettings();
  const whatsapp = settings.whatsapp_number?.replace(/[^0-9]/g, "");

  const copy = {
    eyebrow: settings.coming_soon_eyebrow || COMING_SOON_DEFAULTS.eyebrow,
    title: settings.coming_soon_title || COMING_SOON_DEFAULTS.title,
    body: settings.coming_soon_body || COMING_SOON_DEFAULTS.body,
    note: settings.coming_soon_note || COMING_SOON_DEFAULTS.note,
    contactLine:
      settings.coming_soon_contact_line || COMING_SOON_DEFAULTS.contactLine,
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sea-950 px-6 py-20 text-cream">
      {settings.hero_image && (
        <Image
          src={settings.hero_image}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-25"
        />
      )}

      <div className="relative w-full max-w-xl text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-sea-300">
          {copy.eyebrow}
        </p>

        <h1 className="mt-5 font-serif text-5xl leading-[1.05] sm:text-6xl">
          {copy.title}
        </h1>

        <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-sea-200">
          {copy.body}
        </p>

        <p className="mt-4 font-serif text-2xl text-sea-100">{copy.note}</p>

        <div className="mt-10 text-left">
          <NewsletterSignup />
        </div>

        {(whatsapp || settings.instagram_url || settings.contact_email) && (
          <>
            <p className="mt-12 text-sm text-sea-300">
              {copy.contactLine}
            </p>

            <div className="mt-4 flex items-center justify-center gap-3">
              {settings.instagram_url && (
                <a
                  href={settings.instagram_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-full border border-sea-700 p-3 transition-colors hover:border-sea-400"
                  aria-label="Instagram"
                >
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-full border border-sea-700 p-3 transition-colors hover:border-sea-400"
                  aria-label="WhatsApp"
                >
                  <MessageCircle className="h-5 w-5" />
                </a>
              )}
              {settings.contact_email && (
                <a
                  href={`mailto:${settings.contact_email}`}
                  className="rounded-full border border-sea-700 p-3 transition-colors hover:border-sea-400"
                  aria-label="Email"
                >
                  <Mail className="h-5 w-5" />
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
