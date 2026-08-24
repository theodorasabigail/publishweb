"use server";

import { revalidatePath } from "next/cache";
import { MANUAL_CHANNELS, type Address, type SalesChannel } from "@/lib/types";
import { sendOrderConfirmation } from "@/lib/email/notify";
import { adminClient } from "./guard";

export interface PosSaleLine {
  variantId: string;
  quantity: number;
  /** A price agreed for this order only — a wholesale rate, usually. Left
   *  undefined, the catalogue price is used and cannot be influenced from the
   *  screen at all. */
  unitPriceIdr?: number | null;
}

export type PosPaymentMethod = "cash" | "qris" | "card" | "transfer";

/**
 * Where a manual order is going.
 *
 * Deliberately the same shape as the storefront's address snapshot, kelurahan
 * and kecamatan included, so an order typed here and an order placed on the
 * site are indistinguishable to everything downstream — the courier, the
 * shipped email, the customer's own order page.
 */
export interface ManualAddress {
  recipient_name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  /** Kelurahan or desa. */
  village?: string | null;
  /** Kecamatan. */
  district?: string | null;
  city: string;
  province?: string | null;
  postal_code?: string | null;
  country: string;
  email?: string | null;
  /** Biteship's key for the place, when picked from the area lookup. */
  area_id?: string | null;
}

export interface PosSaleResult {
  ok: boolean;
  error?: string;
  order?: {
    id: string;
    human_ref: string;
    status: string;
    channel: SalesChannel;
    total_idr: number;
    cash_received_idr: number | null;
    points_awarded: number;
    paid_at: string | null;
  };
}

/**
 * Write an order that was agreed somewhere other than the website.
 *
 * All the work happens inside the `record_manual_order` Postgres function, in
 * one transaction: prices are read from the database, availability is locked
 * and checked before anything is written, stock is held against the order, and
 * settlement — when the money has actually arrived — runs through the same
 * `mark_order_paid` the online payment webhooks use. An order that fails any
 * check writes nothing at all.
 *
 * A counter sale is this with `channel: "pos"`, `markPaid: true` and no
 * address, which is why the till no longer has an implementation of its own.
 */
export async function recordManualOrder(input: {
  lines: PosSaleLine[];
  channel: SalesChannel;
  paymentMethod?: PosPaymentMethod | null;
  markPaid: boolean;
  cashReceived?: number | null;
  customerId?: string | null;
  note?: string | null;
  channelReference?: string | null;
  address?: ManualAddress | null;
  shippingIdr?: number | null;
  discountIdr?: number | null;
  discountReason?: string | null;
  /** YYYY-MM-DD, in shop time. Recorded as a plain date, not an instant. */
  shipAfter?: string | null;
}): Promise<PosSaleResult> {
  const { supabase, session } = await adminClient();

  if (!input.lines.length) {
    return { ok: false, error: "Add something to the order first." };
  }
  if (!MANUAL_CHANNELS.includes(input.channel)) {
    return { ok: false, error: "Website orders are written by the checkout, not here." };
  }
  if (input.markPaid && !input.paymentMethod) {
    return { ok: false, error: "Say how the money arrived." };
  }
  // No completeness check here on purpose. An order whose address is still
  // coming is a real order, and it belongs in the books now rather than in a
  // chat thread until the customer gets round to sending it. What it cannot do
  // is ship — that is guarded where a tracking number is saved.

  const { data, error } = await supabase.rpc("record_manual_order", {
    p_items: input.lines.map((line) => ({
      variant_id: line.variantId,
      quantity: line.quantity,
      // Null rather than absent when there is no override, so the database
      // sees "use the catalogue" rather than a malformed line.
      unit_price_idr:
        typeof line.unitPriceIdr === "number" && line.unitPriceIdr >= 0
          ? Math.round(line.unitPriceIdr)
          : null,
    })),
    p_channel: input.channel,
    p_payment_method: input.paymentMethod ?? null,
    p_mark_paid: input.markPaid,
    p_cash_received:
      input.markPaid && input.paymentMethod === "cash" ? (input.cashReceived ?? null) : null,
    p_user_id: input.customerId ?? null,
    p_staff_id: session.userId,
    p_note: input.note?.trim() || null,
    p_channel_reference: input.channelReference?.trim() || null,
    p_shipping_address: input.address ?? null,
    p_shipping_idr: input.address ? Math.max(0, input.shippingIdr ?? 0) : 0,
    p_discount_idr: Math.max(0, Math.round(input.discountIdr ?? 0)),
    p_discount_reason: input.discountReason?.trim() || null,
  });

  // The database function knows nothing about ship_after. Set it as a plain
  // column update rather than adding another argument to the settlement RPC.
  if (input.shipAfter && data) {
    const orderRow = Array.isArray(data) ? data[0] : data;
    if (orderRow?.id) {
      await supabase
        .from("orders")
        .update({ ship_after: input.shipAfter })
        .eq("id", orderRow.id);
    }
  }

  if (error) {
    // The function raises messages written to be read at the counter ("Only 2
    // of Gayo Arunika (200g) available"), so pass them straight through rather
    // than replacing them with something generic.
    return { ok: false, error: error.message ?? "Could not save the order." };
  }

  const order = (Array.isArray(data) ? data[0] : data) as PosSaleResult["order"];

  // A paid order that has to be packed is a real order the customer should get
  // a receipt for. A counter sale is not — they are standing in front of you,
  // holding the coffee — and neither is one that has not been paid yet.
  if (order && order.paid_at && input.address) {
    await sendOrderConfirmation(order.id);
  }

  // Stock or holds moved, so the storefront needs re-rendering.
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/pos");
  revalidatePath("/admin/products");

  return { ok: true, order };
}

/** Ring up a counter sale. The one-tap path, kept as its own name. */
export async function recordSale(input: {
  lines: PosSaleLine[];
  paymentMethod: PosPaymentMethod;
  cashReceived?: number | null;
  customerId?: string | null;
  note?: string | null;
}): Promise<PosSaleResult> {
  return recordManualOrder({
    lines: input.lines,
    channel: "pos",
    paymentMethod: input.paymentMethod,
    markPaid: true,
    cashReceived: input.cashReceived,
    customerId: input.customerId,
    note: input.note,
  });
}

/** Customer lookup for attaching loyalty points and finding a saved address. */
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
    .select("id, display_name, email, phone, loyalty_points, tier")
    .or(`display_name.ilike.%${escaped}%,email.ilike.%${escaped}%`)
    .limit(8);

  return (data ?? []) as {
    id: string;
    display_name: string | null;
    email: string | null;
    phone: string | null;
    loyalty_points: number;
    tier: string;
  }[];
}

/**
 * Addresses this customer has already used.
 *
 * Saves retyping an address the shop already has, which is most of the reason
 * attaching a customer is worth doing on a shipped order at all.
 */
export async function customerAddresses(userId: string) {
  const { supabase } = await adminClient();
  if (!userId) return [];

  const { data } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .limit(10);

  return (data ?? []) as Address[];
}
