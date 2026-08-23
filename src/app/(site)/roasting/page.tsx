import type { Metadata } from "next";
import { RoastingRequestForm } from "@/components/shop/roasting-form";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { PageBlocks } from "@/components/blocks/page-blocks";
import { blocksReplacePage, pageCopy } from "@/lib/blocks";
import { pageText, textLines } from "@/lib/page-text";
import { getPageContext, getSiteSettings } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Jasa Roasting — custom roasting service",
  description:
    "Send us your green beans and we will roast them to your profile. Tell us the origin, volume and roast level, and we will quote you.",
  alternates: { canonical: "/roasting" },
};

export default async function RoastingPage() {
  const [settings, { page, blocks }] = await Promise.all([
    getSiteSettings(),
    getPageContext("roasting"),
  ]);
  const session = isSupabaseConfigured() ? await getSession() : null;
  const whatsapp = settings.whatsapp_number?.replace(/[^0-9]/g, "");

  if (blocksReplacePage(page, blocks.length)) {
    return <PageBlocks blocks={blocks} />;
  }

  const copy = pageCopy("roasting", page);
  // Everything on this page below the intro, as the operator has worded it —
  // or as it ships, for anything they have left alone.
  const t = pageText("roasting", page?.copy);

  return (
    <div className="container-page py-14">
      <div className="grid gap-12 lg:grid-cols-[1fr_460px]">
        <div className="max-w-xl">
          <p className="microcaps text-sea-800">{t("kicker")}</p>
          <h1 className="mt-3 text-4xl sm:text-5xl">{copy.heading}</h1>
          {copy.intro && (
            <p className="mt-5 whitespace-pre-line leading-relaxed text-sea-700">
              {copy.intro}
            </p>
          )}

          <div className="mt-10 space-y-6">
            {[1, 2, 3, 4]
              .map((step) => ({
                step: String(step),
                title: t(`step${step}_title`),
                body: t(`step${step}_body`),
              }))
              // A step the operator has emptied is a step they removed.
              .filter((item) => item.title || item.body)
              .map((item) => (
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
              {t("whatsapp_before")}{" "}
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium underline underline-offset-4"
              >
                {t("whatsapp_link")}
              </a>{" "}
              {t("whatsapp_after")}
            </p>
          )}
        </div>

        <div className="card h-fit p-6 sm:p-8 lg:sticky lg:top-24">
          <h2 className="text-2xl">{t("form_title")}</h2>
          <p className="mt-2 text-sm text-sea-800">{t("form_intro")}</p>
          <div className="mt-6">
            <RoastingRequestForm
              defaultEmail={session?.email ?? ""}
              defaultName={session?.profile?.display_name ?? ""}
              copy={{
                field_name: t("field_name"),
                field_phone: t("field_phone"),
                field_phone_placeholder: t("field_phone_placeholder"),
                field_email: t("field_email"),
                field_origin: t("field_origin"),
                field_origin_placeholder: t("field_origin_placeholder"),
                field_quantity: t("field_quantity"),
                field_roast: t("field_roast"),
                field_roast_empty: t("field_roast_empty"),
                roast_levels: textLines(t("roast_levels")),
                field_notes: t("field_notes"),
                field_notes_placeholder: t("field_notes_placeholder"),
                submit: t("submit"),
                submitting: t("submitting"),
                sent_title: t("sent_title"),
                sent_body: t("sent_body"),
              }}
            />
          </div>
        </div>
      </div>
      <PageBlocks blocks={blocks} />
    </div>
  );
}
