import type { Metadata } from "next";
import { RoastingRequestForm } from "@/components/shop/roasting-form";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { getSiteSettings } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Jasa Roasting — custom roasting service",
  description:
    "Send us your green beans and we will roast them to your profile. Tell us the origin, volume and roast level, and we will quote you.",
  alternates: { canonical: "/roasting" },
};

export default async function RoastingPage() {
  const settings = await getSiteSettings();
  const session = isSupabaseConfigured() ? await getSession() : null;
  const whatsapp = settings.whatsapp_number?.replace(/[^0-9]/g, "");

  return (
    <div className="container-page py-14">
      <div className="grid gap-12 lg:grid-cols-[1fr_460px]">
        <div className="max-w-xl">
          <p className="microcaps text-sea-800">
            Jasa Roasting
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl">
            Your green beans, our drum.
          </h1>
          <p className="mt-5 leading-relaxed text-sea-700">
            We roast to order for cafés, small brands, and anyone with a sack of
            green coffee and nowhere to roast it. Every job is quoted
            individually — volume, origin and target profile all move the number.
          </p>

          <div className="mt-10 space-y-6">
            {[
              {
                step: "1",
                title: "Tell us what you have",
                body: "Origin, process, how many kilos, and the roast level you are after.",
              },
              {
                step: "2",
                title: "We quote you",
                body: "Usually within one working day, by WhatsApp or email — whichever you prefer.",
              },
              {
                step: "3",
                title: "Send the beans",
                body: "Drop them off or ship them to the roastery. We sample-roast first on larger lots.",
              },
              {
                step: "4",
                title: "Collect, roasted",
                body: "Bagged, degassed, and labelled with the roast date.",
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sea-800 text-sm text-cream">
                  {item.step}
                </span>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-sea-800">{item.body}</p>
                </div>
              </div>
            ))}
          </div>

          {whatsapp && (
            <p className="mt-10 rounded-xl bg-sea-100 p-4 text-sm text-sea-700">
              Wholesale or a standing order?{" "}
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium underline underline-offset-4"
              >
                Message us on WhatsApp
              </a>{" "}
              and we will talk it through.
            </p>
          )}
        </div>

        <div className="card h-fit p-6 sm:p-8 lg:sticky lg:top-24">
          <h2 className="text-2xl">Request a quote</h2>
          <p className="mt-2 text-sm text-sea-800">
            No commitment. We will come back with a price and a timeline.
          </p>
          <div className="mt-6">
            <RoastingRequestForm
              defaultEmail={session?.email ?? ""}
              defaultName={session?.profile?.display_name ?? ""}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
