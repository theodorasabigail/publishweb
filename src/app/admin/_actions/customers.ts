"use server";

import { revalidatePath } from "next/cache";
import { adminClient, integer, text } from "./guard";

/** Manual points adjustment. Goes through the same ledger-writing function as
 *  order awards, so the customer's history stays complete and auditable. */
export async function adjustLoyaltyPoints(formData: FormData) {
  const { supabase, session } = await adminClient();
  const userId = text(formData, "user_id");
  const points = integer(formData, "points");
  const reason = text(formData, "reason") || "Manual adjustment";

  if (!userId || points === 0) return;

  const { error } = await supabase.rpc("award_loyalty_points", {
    p_user_id: userId,
    p_points: points,
    p_reason: reason,
    p_order_id: null,
    p_created_by: session.userId,
  });

  if (error) throw new Error("Could not adjust the points.");

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${userId}`);
}

/** Override the tier a customer sits in, independent of their points. */
export async function setCustomerTier(formData: FormData) {
  const { supabase } = await adminClient();
  const userId = text(formData, "user_id");
  const tier = text(formData, "tier");

  if (!["bronze", "silver", "gold"].includes(tier)) {
    throw new Error("Unknown tier.");
  }

  await supabase.from("profiles").update({ tier }).eq("id", userId);

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${userId}`);
}

/** Grant or revoke dashboard access. Guarded so the last admin cannot lock
 *  everyone out of the shop's own back office. */
export async function setAdminFlag(formData: FormData) {
  const { supabase, session } = await adminClient();
  const userId = text(formData, "user_id");
  const makeAdmin = text(formData, "is_admin") === "true";

  if (!makeAdmin) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_admin", true);

    if ((count ?? 0) <= 1) {
      throw new Error("You cannot remove the last admin.");
    }
    if (userId === session.userId) {
      throw new Error("You cannot remove your own admin access.");
    }
  }

  await supabase.from("profiles").update({ is_admin: makeAdmin }).eq("id", userId);
  revalidatePath("/admin/customers");
}

/**
 * Hand a customer the points waiting against an email address or phone number.
 *
 * The operator's route, and the only way a phone bucket ever moves. Points
 * waiting against an email collect themselves when that person signs up, since
 * Supabase has confirmed the address. A phone number is confirmed by nothing —
 * `profiles.phone` is whatever was typed into a form — so handing those over is
 * a judgement about whether this is the right person, and judgements belong to
 * a human.
 */
export async function linkPendingPoints(formData: FormData) {
  const { supabase, session } = await adminClient();
  const userId = text(formData, "user_id");
  const identifier = text(formData, "identifier");

  if (!identifier) throw new Error("Type the email address or phone number to collect from.");

  const { error } = await supabase.rpc("link_pending_points", {
    p_user_id: userId,
    p_identifier: identifier,
    p_by: session.userId,
  });

  // The function's message names what it could not find, which is the useful
  // part when a number has been mistyped.
  if (error) throw new Error(error.message ?? "Could not collect those points.");

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${userId}`);
}
