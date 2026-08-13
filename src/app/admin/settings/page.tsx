import Link from "next/link";
import { ImageIcon, Truck } from "lucide-react";
import { HomepageCategoryPicker } from "@/components/admin/homepage-categories";
import { VisibilityStatus } from "@/components/admin/visibility-status";
import { ImageUploader } from "@/components/admin/image-uploader";
import { Field, PageHeader, Panel } from "@/components/admin/ui";
import { updateSiteSettings } from "@/app/admin/_actions/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Category, SiteSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const supabase = createAdminClient();
  const [{ data: settings }, { data: categories }] = await Promise.all([
    supabase.from("site_settings").select("*").eq("id", true).maybeSingle(),
    supabase.from("categories").select("*").order("sort_order"),
  ]);

  const site = settings as SiteSettings;
  const categoryRows = (categories ?? []) as Category[];

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
          title="Homepage categories"
          description="Which groups of coffee are shown on the front page, and in what order."
        >
          <HomepageCategoryPicker
            categories={categoryRows}
            selectedIds={site?.homepage_category_ids ?? []}
          />
        </Panel>

        <form action={updateSiteSettings} className="space-y-6">
          <Panel title="Hero" description="The big block at the top of the homepage.">
            <div className="space-y-5">
              <ImageUploader
                name="hero_image"
                label="Background image"
                defaultValue={site?.hero_image}
                folder="hero"
                hint="Optional. Wide images work best; text sits on top of it."
              />
              <Field label="Headline">
                <input
                  name="hero_title"
                  className="input"
                  defaultValue={site?.hero_title ?? "Coffee, published."}
                />
              </Field>
              <Field label="Sub-heading">
                <textarea
                  name="hero_subtitle"
                  className="input min-h-20"
                  defaultValue={site?.hero_subtitle ?? ""}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Button text">
                  <input
                    name="hero_cta_label"
                    className="input"
                    defaultValue={site?.hero_cta_label ?? ""}
                  />
                </Field>
                <Field label="Button link" hint="A path on this site, like /shop.">
                  <input
                    name="hero_cta_href"
                    className="input"
                    defaultValue={site?.hero_cta_href ?? "/shop"}
                  />
                </Field>
              </div>
            </div>
          </Panel>

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
                  className="h-4 w-4 rounded border-bark-300"
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
            <p className="mt-3 text-xs text-bark-500">
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

          <div className="sticky bottom-0 -mx-5 border-t border-bark-200 bg-white/95 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
            <button type="submit" className="btn-primary">
              Save settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
