"use server";

import { revalidatePath } from "next/cache";
import { adminClient, boolean, integer, optionalText, text } from "./guard";

/**
 * The bounded presentation controls (spec §7.2) plus the operational knobs.
 *
 * Each field maps to a column the storefront templates already read. There is
 * deliberately no free-form layout editing here.
 */
export async function updateSiteSettings(formData: FormData) {
  const { supabase } = await adminClient();

  const { error } = await supabase
    .from("site_settings")
    .update({
      hero_image: optionalText(formData, "hero_image"),
      hero_title: text(formData, "hero_title") || "Coffee, published.",
      hero_subtitle: optionalText(formData, "hero_subtitle"),
      hero_cta_label: optionalText(formData, "hero_cta_label"),
      hero_cta_href: optionalText(formData, "hero_cta_href"),
      banner_enabled: boolean(formData, "banner_enabled"),
      banner_image: optionalText(formData, "banner_image"),
      banner_text: optionalText(formData, "banner_text"),
      banner_link: optionalText(formData, "banner_link"),
      announcement_note: optionalText(formData, "announcement_note"),
      loyalty_rupiah_per_point: Math.max(
        1,
        integer(formData, "loyalty_rupiah_per_point", 10000),
      ),
      tier_silver_threshold: Math.max(1, integer(formData, "tier_silver_threshold", 100)),
      tier_gold_threshold: Math.max(2, integer(formData, "tier_gold_threshold", 500)),
      whatsapp_number: optionalText(formData, "whatsapp_number"),
      instagram_url: optionalText(formData, "instagram_url"),
      contact_email: optionalText(formData, "contact_email"),
      seo_title: text(formData, "seo_title") || "Publish Coffee Roasters",
      seo_description: optionalText(formData, "seo_description"),
      og_image_url: optionalText(formData, "og_image_url"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  if (error) throw new Error("Could not save the settings.");

  revalidatePath("/", "layout");
}

/** Which categories appear on the homepage, and in what order. */
export async function updateHomepageCategories(ids: string[]) {
  const { supabase } = await adminClient();

  await supabase
    .from("site_settings")
    .update({ homepage_category_ids: ids, updated_at: new Date().toISOString() })
    .eq("id", true);

  revalidatePath("/");
  return { ok: true };
}

export async function setFeaturedPost(formData: FormData) {
  const { supabase } = await adminClient();
  const postId = optionalText(formData, "post_id");

  await supabase
    .from("site_settings")
    .update({ featured_post_id: postId, updated_at: new Date().toISOString() })
    .eq("id", true);

  revalidatePath("/blog");
  revalidatePath("/admin/blog");
}

export async function saveShippingZone(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");

  const fields = {
    code: text(formData, "code"),
    name: text(formData, "name"),
    country_codes: text(formData, "country_codes")
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean),
    is_domestic: boolean(formData, "is_domestic"),
    base_rate_idr: Math.max(0, integer(formData, "base_rate_idr")),
    threshold_grams: Math.max(1, integer(formData, "threshold_grams", 1000)),
    heavy_rate_idr: Math.max(0, integer(formData, "heavy_rate_idr")),
    free_shipping_over_idr: (() => {
      const raw = text(formData, "free_shipping_over_idr");
      if (!raw) return null;
      const value = Number(raw);
      return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
    })(),
    delivery_estimate: optionalText(formData, "delivery_estimate"),
    is_active: boolean(formData, "is_active"),
    sort_order: integer(formData, "sort_order"),
  };

  if (!fields.code || !fields.name) throw new Error("A zone needs a code and a name.");

  const { error } = id
    ? await supabase.from("shipping_zones").update(fields).eq("id", id)
    : await supabase.from("shipping_zones").insert(fields);

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "Another zone is already using that code."
        : "Could not save the zone.",
    );
  }

  revalidatePath("/shipping");
  revalidatePath("/admin/settings/shipping");
}

export async function deleteShippingZone(formData: FormData) {
  const { supabase } = await adminClient();
  await supabase.from("shipping_zones").delete().eq("id", text(formData, "id"));

  revalidatePath("/shipping");
  revalidatePath("/admin/settings/shipping");
}

/** Resolve an unmatched bank credit: either tie it to an order (settling it
 *  exactly as the webhook would have) or dismiss it as not-a-payment. */
export async function resolvePaymentEvent(formData: FormData) {
  const { supabase } = await adminClient();
  const eventId = text(formData, "event_id");
  const orderId = optionalText(formData, "order_id");

  if (orderId) {
    const { error } = await supabase.rpc("mark_order_paid", {
      p_order_id: orderId,
      p_payment_ref: text(formData, "reference") || null,
      p_payment_method: "bank_transfer",
    });
    if (error) throw new Error("Could not settle that order.");
  }

  await supabase
    .from("payment_events")
    .update({
      is_resolved: true,
      is_matched: Boolean(orderId),
      matched_order_id: orderId,
    })
    .eq("id", eventId);

  revalidatePath("/admin/payments");
  revalidatePath("/admin/orders");
}
