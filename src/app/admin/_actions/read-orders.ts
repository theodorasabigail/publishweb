"use server";

import * as z from "zod/v4";
import { AiUnavailableError, aiConfigured, readStructured } from "@/lib/ai/claude";
import {
  readOrderBasic,
  splitMessages,
  type CatalogueEntry,
  type ReadOrder,
} from "@/lib/order-reading";
import { normalisePhone } from "@/lib/parse-address";
import type { SalesChannel } from "@/lib/types";
import { adminClient } from "./guard";
import { findCustomerByPhone, recordManualOrder, type ManualAddress } from "./pos";

/**
 * Read one or more pasted messages into orders for the till to check.
 *
 * Nothing is saved here. The till shows what was read and the operator saves
 * it -- or, for a batch, ticks the ones that look right and saves those.
 */

const ItemSchema = z.object({
  variant_id: z
    .string()
    .describe('The id from the catalogue, exactly as listed, or "" if nothing in the catalogue fits.'),
  quantity: z.number().describe("How many bags of this size. 1 if not said."),
  as_written: z.string().describe("The words in the message this item came from."),
});

const OrderSchema = z.object({
  customer_name: z.string().describe('The customer\'s name, or "".'),
  phone: z.string().describe('Their phone number as written, or "".'),
  email: z.string().describe('Their email, or "".'),
  instagram_handle: z.string().describe('An @handle if the order came over Instagram, or "".'),
  channel: z.enum(["whatsapp", "instagram", "marketplace", "other", "unknown"]),
  items: z.array(ItemSchema),
  not_in_catalogue: z
    .array(z.string())
    .describe("Anything the customer asked for that matches nothing in the catalogue, as written."),
  delivery: z.enum(["ship", "collect", "unknown"]),
  recipient_name: z.string().describe('Who the parcel is for, or "".'),
  recipient_phone: z.string(),
  street: z.string().describe('Street, house number, building, complex -- or "".'),
  rt_rw_landmark: z.string().describe('RT/RW and any landmark, or "".'),
  kelurahan: z.string(),
  kecamatan: z.string(),
  city: z.string().describe('Kota or kabupaten, e.g. "Bandung" or "Kabupaten Sleman".'),
  province: z.string(),
  postal_code: z.string(),
  shipping_idr: z.number().describe("Shipping cost agreed in the message in rupiah, or -1 if not mentioned."),
  payment: z.enum(["paid", "not_paid", "unknown"]).describe('"paid" only if the message says the money has been sent.'),
  payment_method: z.enum(["transfer", "qris", "cash", "card", "unknown"]),
  note: z.string().describe('Anything else the shop should remember (grind, gift note, timing), or "".'),
  ship_after: z.string().describe('YYYY-MM-DD if they asked for it not to be sent before a date, else "".'),
});

const ResultSchema = z.object({ orders: z.array(OrderSchema) });

async function loadCatalogue(): Promise<CatalogueEntry[]> {
  const { supabase } = await adminClient();
  const { data } = await supabase
    .from("product_variants")
    .select("id, size, price_idr, available, is_active, products!inner ( name, is_active )")
    .eq("is_active", true)
    // The till only offers coffees that are on the shop, so only those can
    // be matched -- anything else would vanish between here and the basket.
    .eq("products.is_active", true);

  return ((data ?? []) as unknown as {
    id: string;
    size: string;
    price_idr: number;
    available: number;
    products: { name: string; is_active: boolean };
  }[]).map((row) => ({
    variantId: row.id,
    productName: row.products.name,
    size: row.size,
    priceIdr: row.price_idr,
    available: row.available,
  }));
}

function systemPrompt(catalogue: CatalogueEntry[]): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const lines = catalogue
    .map((entry) => `${entry.variantId} | ${entry.productName} | ${entry.size} | Rp ${entry.priceIdr}`)
    .join("\n");

  return `You read customer orders for Publish Coffee Roasters, a small Indonesian coffee roaster that sells bags of roasted coffee. The orders arrive as WhatsApp, Instagram or marketplace messages, mostly in Indonesian, often informal ("kak", "mau", "sama", "udah tf ya").

The text you are given may hold one order or several. Return one entry per customer order, in the order they appear. Several messages from the same customer about the same purchase are one order. Greetings, chit-chat and the shop's own replies are not orders.

Match every item to the catalogue below and use its id exactly. Customers shorten names ("gayo", "kinta"), misspell them, and write sizes as "200gr", "2 ons", "1/4 kg" or "sekilo" -- match on meaning. If the size is not said and the coffee has only one size, use that one. If something cannot be matched with confidence, leave variant_id as "" for that item and also list it in not_in_catalogue -- never guess an id.

Only mark payment "paid" when the message says the money has already been sent (for example "udah transfer", "sudah tf", "ini bukti tf"). Asking for the bank details or the total is not paid.

Leave a field as "" when the message does not say it. Do not invent addresses, names or numbers. Today's date in Indonesia is ${today}.

Catalogue (id | coffee | size | price):
${lines}`;
}

function toReadOrder(order: z.infer<typeof OrderSchema>, catalogue: CatalogueEntry[]): ReadOrder {
  const known = new Set(catalogue.map((entry) => entry.variantId));
  const items: ReadOrder["items"] = [];
  const unmatched = [...order.not_in_catalogue];

  for (const item of order.items) {
    if (!known.has(item.variant_id)) {
      if (item.as_written && !unmatched.includes(item.as_written)) unmatched.push(item.as_written);
      continue;
    }
    const quantity = Math.max(1, Math.round(item.quantity || 1));
    const existing = items.find((line) => line.variantId === item.variant_id);
    if (existing) existing.quantity += quantity;
    else items.push({ variantId: item.variant_id, quantity, asWritten: item.as_written });
  }

  const channel: SalesChannel | null = order.channel === "unknown" ? null : order.channel;
  const phone = order.phone ? normalisePhone(order.phone) : "";
  const recipientPhone = order.recipient_phone ? normalisePhone(order.recipient_phone) : phone;

  return {
    customerName: order.customer_name,
    phone,
    email: order.email,
    channel,
    reference: channel === "instagram" ? order.instagram_handle || phone : phone,
    items,
    unmatched,
    ships: order.delivery === "ship" ? true : order.delivery === "collect" ? false : null,
    address: {
      recipient_name: order.recipient_name || order.customer_name,
      phone: recipientPhone,
      email: order.email,
      line1: order.street,
      line2: order.rt_rw_landmark,
      village: order.kelurahan,
      district: order.kecamatan,
      city: order.city,
      province: order.province,
      postal_code: order.postal_code,
    },
    shippingIdr: order.shipping_idr >= 0 ? Math.round(order.shipping_idr) : null,
    paid: order.payment === "paid" ? true : order.payment === "not_paid" ? false : null,
    paymentMethod: order.payment_method === "unknown" ? null : order.payment_method,
    note: order.note,
    shipAfter: /^\d{4}-\d{2}-\d{2}$/.test(order.ship_after) ? order.ship_after : "",
  };
}

export interface ReadOrdersResult {
  ok: boolean;
  orders: ReadOrder[];
  catalogue: CatalogueEntry[];
  /** "ai" when Claude read it; "basic" when the plain matcher did. */
  source: "ai" | "basic";
  /** Why the AI was not used, when it was wanted and failed. */
  notice?: string;
  error?: string;
}

export async function readOrders(text: string): Promise<ReadOrdersResult> {
  await adminClient();
  const trimmed = text.trim();
  const catalogue = await loadCatalogue();

  if (!trimmed) {
    return { ok: false, orders: [], catalogue, source: "basic", error: "Paste a message first." };
  }
  if (trimmed.length > 20_000) {
    return {
      ok: false,
      orders: [],
      catalogue,
      source: "basic",
      error: "That is a lot of text — paste up to about twenty orders at a time.",
    };
  }

  if (aiConfigured()) {
    try {
      const result = await readStructured({
        schema: ResultSchema,
        system: systemPrompt(catalogue),
        text: trimmed,
      });
      const orders = result.orders.map((order) => toReadOrder(order, catalogue));
      if (orders.length) return { ok: true, orders, catalogue, source: "ai" };
      return {
        ok: false,
        orders: [],
        catalogue,
        source: "ai",
        error: "No order found in that text.",
      };
    } catch (error) {
      if (!(error instanceof AiUnavailableError)) throw error;
      const orders = splitMessages(trimmed).map((part) => readOrderBasic(part, catalogue));
      return { ok: true, orders, catalogue, source: "basic", notice: error.message };
    }
  }

  const orders = splitMessages(trimmed).map((part) => readOrderBasic(part, catalogue));
  return { ok: true, orders, catalogue, source: "basic" };
}

/**
 * Save one read order exactly as it stands, from the batch list.
 *
 * Same path as the till's own button -- record_manual_order, stock held or
 * taken, short coffee allowed to run into "to roast" -- so an order saved from
 * the list is indistinguishable from one typed in.
 */
export async function saveReadOrder(
  order: ReadOrder,
): Promise<{ ok: boolean; ref?: string; error?: string }> {
  await adminClient();
  if (!order.items.length) return { ok: false, error: "No coffee on this order." };

  const catalogue = await loadCatalogue();
  const available = new Map(catalogue.map((entry) => [entry.variantId, entry.available]));
  const short = order.items.some((item) => item.quantity > (available.get(item.variantId) ?? 0));

  const customer = order.phone ? await findCustomerByPhone(order.phone).catch(() => null) : null;
  const ships = order.ships === true;
  const paid = order.paid === true;
  const address: ManualAddress | null = ships
    ? { ...order.address, country: "ID", area_id: null }
    : null;

  const result = await recordManualOrder({
    lines: order.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
    channel: order.channel ?? "whatsapp",
    paymentMethod: paid ? (order.paymentMethod ?? "transfer") : null,
    markPaid: paid,
    customerId: customer?.id ?? null,
    note: order.note || null,
    channelReference: order.reference || null,
    address,
    shippingIdr: ships ? (order.shippingIdr ?? 0) : 0,
    shipAfter: order.shipAfter || null,
    allowShort: short,
  });

  if (!result.ok || !result.order) return { ok: false, error: result.error ?? "Could not save." };
  return { ok: true, ref: result.order.human_ref };
}
