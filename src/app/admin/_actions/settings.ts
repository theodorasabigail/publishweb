"use server";

import { revalidatePath } from "next/cache";
import { sendOrderConfirmation } from "@/lib/email/notify";
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
    subsidy_over_idr: (() => {
      const raw = text(formData, "subsidy_over_idr");
      if (!raw) return null;
      const value = Number(raw);
      return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
    })(),
    subsidy_idr: Math.max(0, integer(formData, "subsidy_idr")),
    delivery_estimate: optionalText(formData, "delivery_estimate"),
    is_active: boolean(formData, "is_active"),
    sort_order: integer(formData, "sort_order"),
  };

  if (!fields.code || !fields.name) throw new Error("A zone needs a code and a name.");

  if (
    fields.free_shipping_over_idr !== null &&
    fields.subsidy_over_idr !== null &&
    fields.subsidy_over_idr >= fields.free_shipping_over_idr
  ) {
    throw new Error(
      "The partial discount has to start below the free-shipping figure, otherwise nobody ever gets it.",
    );
  }

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

/** Where parcels ship from. Unused by flat zones; required by any live-rate
 *  courier API, which prices origin-to-destination. */
export async function updateShippingOrigin(formData: FormData) {
  const { supabase } = await adminClient();

  await supabase
    .from("site_settings")
    .update({
      origin_contact_name: optionalText(formData, "origin_contact_name"),
      origin_phone: optionalText(formData, "origin_phone"),
      origin_address: optionalText(formData, "origin_address"),
      origin_city: optionalText(formData, "origin_city"),
      origin_province: optionalText(formData, "origin_province"),
      origin_postal_code: optionalText(formData, "origin_postal_code"),
      origin_area_code: optionalText(formData, "origin_area_code"),
      origin_note: optionalText(formData, "origin_note"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

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
    await sendOrderConfirmation(orderId);
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

/**
 * Delete media files that no row points at any more.
 *
 * The candidate list comes from `unused_media()`, which excludes anything
 * uploaded in the last 24 hours -- a file lives in the bucket from the moment
 * it uploads until the form around it is saved, and that window must never be
 * mistaken for garbage. The list is recomputed here rather than trusted from
 * the form, so a stale page cannot delete a file that has since been used.
 */
export async function deleteUnusedMedia(): Promise<void> {
  const { supabase } = await adminClient();

  const { data, error } = await supabase.rpc("unused_media");
  if (error) throw new Error("Could not work out which files are unused.");

  const names = ((data ?? []) as { name: string }[]).map((row) => row.name);
  if (!names.length) return;

  // Supabase caps how many paths one remove() call accepts; chunk to be safe.
  for (let i = 0; i < names.length; i += 100) {
    const { error: removeError } = await supabase.storage
      .from("media")
      .remove(names.slice(i, i + 100));
    if (removeError) throw new Error("Could not delete the files.");
  }

  revalidatePath("/admin/settings/media");
}

/** Supabase's free plan allowance for file storage. */
const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;
const STORAGE_BLOCK_RATIO = 0.95;
const STORAGE_WARN_RATIO = 0.8;

export interface MediaBudget {
  usedBytes: number;
  limitBytes: number;
  percent: number;
  /** Refuse further uploads — the plan is effectively full. */
  blocked: boolean;
  message: string | null;
}

/**
 * Checked before every upload.
 *
 * The Images & storage page reports usage, but reporting is not protection:
 * without this, the only signal that storage ran out would be uploads failing
 * with whatever error Supabase happens to return. This turns that into a clear
 * refusal with a way out, one step before the wall.
 */
export async function checkMediaBudget(): Promise<MediaBudget> {
  const { supabase } = await adminClient();

  const { data, error } = await supabase.rpc("media_storage_usage");
  if (error) {
    // Never block an upload because the check itself failed.
    return {
      usedBytes: 0,
      limitBytes: STORAGE_LIMIT_BYTES,
      percent: 0,
      blocked: false,
      message: null,
    };
  }

  const row = ((data ?? []) as { total_bytes: number }[])[0];
  const usedBytes = Number(row?.total_bytes ?? 0);
  const percent = (usedBytes / STORAGE_LIMIT_BYTES) * 100;

  if (percent >= STORAGE_BLOCK_RATIO * 100) {
    return {
      usedBytes,
      limitBytes: STORAGE_LIMIT_BYTES,
      percent,
      blocked: true,
      message:
        "Image storage is full. Clear unused images in Site settings → Images & storage, then try again.",
    };
  }

  if (percent >= STORAGE_WARN_RATIO * 100) {
    return {
      usedBytes,
      limitBytes: STORAGE_LIMIT_BYTES,
      percent,
      blocked: false,
      message: `Image storage is ${Math.round(percent)}% full. Worth clearing unused images soon.`,
    };
  }

  return { usedBytes, limitBytes: STORAGE_LIMIT_BYTES, percent, blocked: false, message: null };
}

/**
 * Send a real email to an address the operator types, and say what happened.
 *
 * Every other path deliberately swallows email failures so a mail outage can
 * never break an order. That makes "is email working?" unanswerable without
 * this: it is the one place a failure is reported rather than logged.
 */
export async function testEmailDelivery(
  formData: FormData,
): Promise<{ ok: boolean; summary: string; advice?: string }> {
  await adminClient();

  const { getEmailProvider, sendEmail } = await import("@/lib/email");
  const { testEmail } = await import("@/lib/email/templates");

  const to = text(formData, "to");
  if (!to.includes("@")) {
    return { ok: false, summary: "That does not look like an email address." };
  }

  const provider = getEmailProvider();
  if (provider.id === "none") {
    return {
      ok: false,
      summary: "No email service is connected yet.",
      advice:
        "Add RESEND_API_KEY and EMAIL_FROM in Vercel → Settings → Environment Variables, then redeploy. Until then the shop works exactly as it does now, just without receipts.",
    };
  }

  const result = await sendEmail(testEmail(to));

  if (result.ok) {
    return {
      ok: true,
      summary: `Sent to ${to}. It should arrive within a minute.`,
      advice: "If it does not appear, check the spam folder before changing anything.",
    };
  }

  return {
    ok: false,
    summary: `${provider.label} refused to send it.`,
    advice: adviceFor(result.error),
  };
}

/** Turn the provider's error into something actionable. */
function adviceFor(error: string | undefined): string {
  const message = (error ?? "").toLowerCase();

  if (message.includes("resend_api_key") || message.includes("email_from")) {
    return "RESEND_API_KEY or EMAIL_FROM is missing in Vercel. Add both, then redeploy.";
  }
  if (message.includes("api key") || message.includes("unauthorized") || message.includes("401")) {
    return "Resend did not accept the key. Check RESEND_API_KEY in Vercel matches the one in your Resend dashboard, then redeploy.";
  }
  if (message.includes("domain") || message.includes("not verified") || message.includes("403")) {
    return "Your sending domain is not verified yet. In Resend → Domains, add the DNS records it lists to wherever your domain is managed, and wait for it to go green. Until then Resend only lets you email your own account address.";
  }
  if (message.includes("timeout") || message.includes("reach")) {
    return "Could not reach Resend. Almost certainly temporary — try again shortly.";
  }
  return error ?? "No reason given.";
}

/** Ask Biteship for a real quote and report back in plain words. */
export async function testCourierConnection(formData: FormData) {
  const { supabase } = await adminClient();
  const { diagnoseBiteship } = await import("@/lib/shipping/biteship-provider");
  return diagnoseBiteship(supabase, text(formData, "destination_postal_code"));
}
