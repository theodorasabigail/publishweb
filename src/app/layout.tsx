import type { Metadata } from "next";
import { CartProvider } from "@/components/cart-provider";
import { getSiteSettings } from "@/lib/queries";
import { siteUrl } from "@/lib/env";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: settings.seo_title,
      template: `%s · Publish Coffee Roasters`,
    },
    description: settings.seo_description ?? undefined,
    openGraph: {
      type: "website",
      siteName: "Publish Coffee Roasters",
      title: settings.seo_title,
      description: settings.seo_description ?? undefined,
      images: settings.og_image_url ? [settings.og_image_url] : undefined,
    },
    twitter: {
      card: "summary_large_image",
    },
    alternates: {
      canonical: "/",
      types: { "application/rss+xml": "/rss.xml" },
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
