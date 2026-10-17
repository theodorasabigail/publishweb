import Link from "next/link";
import { ImageIcon, Mail, Truck } from "lucide-react";
import { VisibilityStatus } from "@/components/admin/visibility-status";
import { ImageUploader } from "@/components/admin/image-uploader";
import { Field, PageHeader, Panel } from "@/components/admin/ui";
import { updateSiteSettings } from "@/app/admin/_actions/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { COMING_SOON_DEFAULTS } from "@/lib/coming-soon";
import type { SiteSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const supabase = createAdminClient();
  const { data: settings } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  const site = settings as SiteSettings;

  return (
    <div>
      <PageHeader
        title="Site settings"
        description="The parts of the site you can change without touching code."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/settings/media" className="btn-secondary">
              <ImageIcon className="h-4 w-4" /> Images & storage
            </Link>
            <Link href="/admin/settings/shipping" className="btn-secondary">
              <Truck className="h-4 w-4" /> Shipping rates
            </Link>
            <Link href="/admin/settings/email" className="btn-secondary">
              <Mail className="h-4 w-4" /> Emails
            </Link>
          </div>
        }
      />

      <div className="space-y-6">
        <Panel
          title="Is your shop public?"
          description="Whether visitors can see and buy, or only see a coming-soon page."
        >
          <VisibilityStatus />
        </Panel>

        <Panel
          title="The homepage"
          description="Its big picture, its words and which categories it shows."
        >
          <p className="text-sm text-sea-800">
            Everything on the homepage is now edited on the homepage itself: open your site
            while signed in and press <strong>Edit this page</strong>. (The first time, it
            asks to set the homepage up — one click, nothing is lost.)
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/" className="btn-primary py-2 text-xs">
              Edit the homepage
            </Link>
            <Link href="/admin/pages/home" className="btn-secondary py-2 text-xs">
              Or edit it here in the admin
            </Link>
          </div>
        </Panel>

        <form action={updateSiteSettings} className="space-y-6">
          <Panel
            title="Announcement banner"
            description="The thin strip above the menu. Good for a sale, a holiday closure, or a new lot."
          >
            <div className="space-y-5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="banner_enabled"
                  defaultChecked={site?.banner_enabled ?? false}
                  className="h-4 w-4 rounded border-sea-300"
                />
                Show the banner
              </label>
              <Field label="Text">
                <input
                  name="banner_text"
                  className="input"
                  defaultValue={site?.banner_text ?? ""}
                  placeholder="Free shipping on Java orders over Rp 500.000"
                />
              </Field>
              <Field label="Link" hint="Optional. Where the banner takes people when clicked.">
                <input
                  name="banner_link"
                  className="input"
                  defaultValue={site?.banner_link ?? ""}
                  placeholder="/shop"
                />
              </Field>
              <ImageUploader
                name="banner_image"
                label="Background image"
                defaultValue={site?.banner_image}
                folder="banner"
              />
            </div>
          </Panel>

          <Panel
            title="Coming-soon page"
            description="What visitors see while the shop is hidden. Leave a box empty to use the wording it came with."
          >
            <div className="space-y-5">
              <Field label="Small line above the name">
                <input
                  name="coming_soon_eyebrow"
                  className="input"
                  defaultValue={site?.coming_soon_eyebrow ?? ""}
                  placeholder={COMING_SOON_DEFAULTS.eyebrow}
                />
              </Field>
              <Field label="Name">
                <input
                  name="coming_soon_title"
                  className="input"
                  defaultValue={site?.coming_soon_title ?? ""}
                  placeholder={COMING_SOON_DEFAULTS.title}
                />
              </Field>
              <Field label="Paragraph" hint="Line breaks are kept.">
                <textarea
                  name="coming_soon_body"
                  className="input min-h-24"
                  defaultValue={site?.coming_soon_body ?? ""}
                  placeholder={COMING_SOON_DEFAULTS.body}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="The line in big type">
                  <input
                    name="coming_soon_note"
                    className="input"
                    defaultValue={site?.coming_soon_note ?? ""}
                    placeholder={COMING_SOON_DEFAULTS.note}
                  />
                </Field>
                <Field label="Above the contact buttons">
                  <input
                    name="coming_soon_contact_line"
                    className="input"
                    defaultValue={site?.coming_soon_contact_line ?? ""}
                    placeholder={COMING_SOON_DEFAULTS.contactLine}
                  />
                </Field>
              </div>
            </div>
            <div className="mt-5">
              <ImageUploader
                name="hero_image"
                label="Background picture"
                defaultValue={site?.hero_image}
                folder="hero"
                hint="Shown behind the coming-soon page."
              />
            </div>
            <p className="mt-4 text-xs text-sea-800">
              The contact
              buttons appear on their own once WhatsApp, Instagram or an email
              address is filled in below. To see the page as visitors do, open{" "}
              <span className="font-mono">/coming-soon</span>.
            </p>
          </Panel>

          <Panel
            title="Loyalty"
            description="How points are earned and where the tiers start."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Rupiah per point" hint="Rp 10.000 spent = 1 point.">
                <input
                  type="number"
                  min="1"
                  name="loyalty_rupiah_per_point"
                  className="input"
                  defaultValue={site?.loyalty_rupiah_per_point ?? 10000}
                />
              </Field>
              <Field label="Silver starts at">
                <input
                  type="number"
                  min="1"
                  name="tier_silver_threshold"
                  className="input"
                  defaultValue={site?.tier_silver_threshold ?? 100}
                />
              </Field>
              <Field label="Gold starts at">
                <input
                  type="number"
                  min="2"
                  name="tier_gold_threshold"
                  className="input"
                  defaultValue={site?.tier_gold_threshold ?? 500}
                />
              </Field>
            </div>
            <p className="mt-3 text-xs text-sea-800">
              Points are only awarded on orders that have actually been paid for.
              Changing these does not re-calculate past orders.
            </p>
          </Panel>

          <Panel title="Contact">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="WhatsApp number" hint="With country code, e.g. 6281234567890.">
                <input
                  name="whatsapp_number"
                  className="input"
                  defaultValue={site?.whatsapp_number ?? ""}
                />
              </Field>
              <Field label="Instagram URL">
                <input
                  name="instagram_url"
                  className="input"
                  defaultValue={site?.instagram_url ?? ""}
                />
              </Field>
              <Field label="Contact email">
                <input
                  name="contact_email"
                  className="input"
                  defaultValue={site?.contact_email ?? ""}
                />
              </Field>
            </div>
          </Panel>

          <Panel
            title="Search engines"
            description="How the site as a whole shows up on Google and when shared."
          >
            <div className="space-y-4">
              <Field label="Site title">
                <input
                  name="seo_title"
                  className="input"
                  defaultValue={site?.seo_title ?? "Publish Coffee Roasters"}
                />
              </Field>
              <Field label="Site description">
                <textarea
                  name="seo_description"
                  className="input min-h-20"
                  defaultValue={site?.seo_description ?? ""}
                />
              </Field>
              <ImageUploader
                name="og_image_url"
                label="Default sharing image"
                defaultValue={site?.og_image_url}
                folder="social"
              />
              <Field label="Internal note" hint="Just for you. Never shown on the site.">
                <input
                  name="announcement_note"
                  className="input"
                  defaultValue={site?.announcement_note ?? ""}
                />
              </Field>
            </div>
          </Panel>

          <div className="sticky bottom-0 -mx-5 border-t border-sea-200 bg-white/95 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
            <button type="submit" className="btn-primary">
              Save settings
            </button>
          </div>

          <section className="rounded-xl border border-sea-200 bg-white p-5">
            <h2 className="text-lg font-medium">Payment methods</h2>
            <p className="mt-1 text-sm text-sea-800">
              The list you pick from when marking an order paid by hand. One
              per line. Written back onto the receipt exactly as typed — use
              names your bookkeeping will recognise (e.g. &ldquo;QRIS Shopee&rdquo;, &ldquo;Transfer BCA&rdquo;).
            </p>
            <textarea
              name="payment_methods"
              className="input mt-3 min-h-32"
              defaultValue={(site?.payment_methods ?? []).join("\n")}
              placeholder="Cash&#10;QRIS Shopee&#10;QRIS BTN&#10;Transfer BCA&#10;Card"
            />
          </section>
        </form>
      </div>
    </div>
  );
}
