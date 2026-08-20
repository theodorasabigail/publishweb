import Link from "next/link";
import { Instagram, Mail, MessageCircle } from "lucide-react";
import { NewsletterSignup } from "@/components/layout/newsletter-signup";
import type { SiteSettings } from "@/lib/types";

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const year = new Date().getFullYear();
  const whatsapp = settings.whatsapp_number?.replace(/[^0-9]/g, "");

  return (
    <footer className="mt-24 border-t border-sea-200/70 bg-sea-950 text-sea-100">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-serif text-xl">Publish Coffee Roasters</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-sea-300">
            Small-batch roasting from Indonesia. We buy carefully, roast to a
            profile we can repeat, and write down what we learn.
          </p>
          <p className="mt-4 text-xs text-sea-400">PT Aroma Pulau Arunika</p>

          <div className="mt-5 flex items-center gap-3">
            {settings.instagram_url && (
              <a
                href={settings.instagram_url}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-full border border-sea-700 p-2 hover:border-sea-400"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
            )}
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-full border border-sea-700 p-2 hover:border-sea-400"
                aria-label="WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            )}
            {settings.contact_email && (
              <a
                href={`mailto:${settings.contact_email}`}
                className="rounded-full border border-sea-700 p-2 hover:border-sea-400"
                aria-label="Email"
              >
                <Mail className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sea-400">Shop</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/shop" className="hover:text-white">All coffee</Link></li>
            <li><Link href="/roasting" className="hover:text-white">Jasa roasting</Link></li>
            <li><Link href="/shipping" className="hover:text-white">Shipping</Link></li>
            <li><Link href="/account" className="hover:text-white">Your account</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sea-400">Read</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/blog" className="hover:text-white">Journal</Link></li>
            <li><Link href="/blog/categories" className="hover:text-white">Categories</Link></li>
            <li><Link href="/about" className="hover:text-white">About us</Link></li>
            <li><a href="/rss.xml" className="hover:text-white">RSS</a></li>
          </ul>
        </div>

        <div className="md:col-span-4">
          <NewsletterSignup />
        </div>
      </div>

      <div className="border-t border-sea-800">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-sea-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} PT Aroma Pulau Arunika. All rights reserved.</p>
          <p>Roasted in Indonesia. Shipped worldwide.</p>
        </div>
      </div>
    </footer>
  );
}
