import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSettings } from "@/lib/queries";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About",
  description:
    "Publish Coffee Roasters is a small-batch roastery run by PT Aroma Pulau Arunika, roasting Indonesian coffee and writing down what we learn.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const settings = await getSiteSettings();
  const whatsapp = settings.whatsapp_number?.replace(/[^0-9]/g, "");

  return (
    <div className="container-page max-w-3xl py-16">
      <h1 className="text-5xl">About us</h1>

      <div className="prose prose-lg mt-8 max-w-none prose-headings:font-serif">
        <p>
          Publish Coffee Roasters is a small roastery in Indonesia, run by PT
          Aroma Pulau Arunika. We buy green coffee from growers we can name,
          roast it in small batches, and publish what we learn along the way —
          which is where the name comes from.
        </p>

        <h2>What we roast</h2>
        <p>
          Mostly Indonesian single origins, plus a couple of blends built for
          milk. Lots rotate through the year with the harvest, so the roast list
          is never quite the same twice. Everything is roasted to order and
          shipped within 48 hours.
        </p>

        <h2>Custom roasting</h2>
        <p>
          We also roast other people&apos;s green beans. If you have a sack and
          nowhere to roast it,{" "}
          <Link href="/roasting">send us the details</Link> and we will quote
          you.
        </p>

        <h2>Shipping</h2>
        <p>
          We ship across Indonesia and internationally, at flat rates by zone —
          no surprise fees at checkout. The{" "}
          <Link href="/shipping">shipping page</Link> has the current rates.
        </p>

        <h2>Say hello</h2>
        <p>
          {settings.contact_email && (
            <>
              Email us at{" "}
              <a href={`mailto:${settings.contact_email}`}>
                {settings.contact_email}
              </a>
              .{" "}
            </>
          )}
          {whatsapp && (
            <>
              Or{" "}
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                message us on WhatsApp
              </a>{" "}
              — that is usually fastest, and it is where wholesale conversations
              start.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
