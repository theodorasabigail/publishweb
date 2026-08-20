import type { Metadata } from "next";
import Image from "next/image";
import { Instagram, Mail, MessageCircle } from "lucide-react";
import { NewsletterSignup } from "@/components/layout/newsletter-signup";
import { getSiteSettings } from "@/lib/queries";

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
        <p className="text-xs uppercase tracking-[0.25em] text-sea-400">
          PT Aroma Pulau Arunika
        </p>

        <h1 className="mt-5 font-serif text-5xl leading-[1.05] sm:text-6xl">
          Publish Coffee Roasters
        </h1>

        <p className="mt-6 text-lg leading-relaxed text-sea-200">
          A small roastery in Indonesia. Rotating single origins, blends we
          actually drink, and a custom roasting service for your own green
          beans.
        </p>

        <p className="mt-4 font-serif text-2xl text-sea-100">Opening soon.</p>

        <div className="mt-10 text-left">
          <NewsletterSignup />
        </div>

        {(whatsapp || settings.instagram_url || settings.contact_email) && (
          <>
            <p className="mt-12 text-sm text-sea-400">
              Roasting for a café, or want coffee before we open? Talk to us.
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
