"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "./guard";

export interface PosSaleLine {
  variantId: string;
  quantity: number;
}

export interface PosSaleResult {
  ok: boolean;
  error?: string;
  order?: {
    id: string;
    human_ref: string;
    total_idr: number;
    cash_received_idr: number | null;
    points_awarded: number;
  };
}

/**
 * Ring up a counter sale.
 *
 * All the work happens inside the `record_pos_sale` Postgres function, in one
 * transaction: prices are read from the database, stock is locked and checked
 * before anything is written, and settlement runs through the same
 * `mark_order_paid` the online payment webhooks use. A sale that fails any
 * check writes nothing at all.
 */
export async function recordSale(input: {
  lines: PosSaleLine[];
  paymentMethod: "cash" | "qris" | "card" | "transfer";
  cashReceived?: number | null;
  customerId?: string | null;
  note?: string | null;
}): Promise<PosSaleResult> {
  const { supabase, session } = await adminClient();

  if (!input.lines.length) {
    return { ok: false, error: "Add something to the sale first." };
  }

  const { data, error } = await supabase.rpc("record_pos_sale", {
    p_items: input.lines.map((line) => ({
      variant_id: line.variantId,
      quantity: line.quantity,
    })),
    p_payment_method: input.paymentMethod,
    p_cash_received: input.paymentMethod === "cash" ? (input.cashReceived ?? null) : null,
    p_user_id: input.customerId ?? null,
    p_staff_id: session.userId,
    p_note: input.note ?? null,
  });

  if (error) {
    // The function raises messages written to be read at the counter
    // ("Only 2 of Gayo Arunika (200g) left in stock"), so pass them straight
    // through rather than replacing them with something generic.
    return { ok: false, error: error.message ?? "Could not complete the sale." };
  }

  // Stock moved, so the storefront needs re-rendering.
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/pos");

  const order = Array.isArray(data) ? data[0] : data;
  return { ok: true, order };
}

/** Customer lookup for attaching loyalty points at the counter. */
export async function findCustomers(query: string) {
  const { supabase } = await adminClient();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  // PostgREST's or() takes a comma-separated filter string, so a comma,
  // parenthesis or dot typed at the till would be parsed as syntax rather
  // than as text. Strip those, then escape LIKE wildcards.
  const safe = trimmed.replace(/[(),.*]/g, " ").trim();
  if (safe.length < 2) return [];
  const escaped = safe.replace(/[%_\\]/g, (match) => `\\${match}`);

  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, email, loyalty_points, tier")
    .or(`display_name.ilike.%${escaped}%,email.ilike.%${escaped}%`)
    .limit(8);

  return (data ?? []) as {
    id: string;
    display_name: string | null;
    email: string | null;
    loyalty_points: number;
    tier: string;
  }[];
}
