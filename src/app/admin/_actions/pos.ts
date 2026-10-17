"use server";

import { revalidatePath } from "next/cache";
import { MANUAL_CHANNELS, type Address, type SalesChannel } from "@/lib/types";
import { sendOrderConfirmation } from "@/lib/email/notify";
import { isWholeNumber, phoneCore, phoneLikePattern, phoneMatches } from "@/lib/phone";
import { adminClient } from "./guard";

export interface PosSaleLine {
  variantId: string;
  quantity: number;
  /** A price agreed for this order only — a wholesale rate, usually. Left
   *  undefined, the catalogue price is used and cannot be influenced from the
   *  screen at all. */
  unitPriceIdr?: number | null;
}

/**
 * The four one-tap buttons the till shows. The database no longer restricts
 * to these -- 0035 opened `record_manual_order` up to any non-empty string,
 * so the admin's Settings-managed list works there too. Kept here as a type
 * so the till's own UI stays typed for its four cases; other callers pass
 * plain strings.
 */
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
  /** Take the order even where the stock count does not cover it. Stock runs
   *  below zero and the shortfall reads as bags owed. */
  allowShort?: boolean;
  /** A counter sale paid now and collected after the roast: left open at
   *  pending instead of finished on the spot, so it is not forgotten. */
  collectLater?: boolean;
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
  const allowShort = Boolean(input.allowShort);
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
    // Only sent when it is on, so an ordinary order still goes through on a
    // database that has not had 0039 yet.
    ...(allowShort ? { p_allow_short: true } : {}),
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

  // record_manual_order finishes a paid counter sale on the spot. One the
  // customer collects after the roast is not finished yet, so it goes back to
  // pending and waits in Orders with everything else still to hand over.
  if (order && input.collectLater && input.channel === "pos") {
    await supabase.from("orders").update({ status: "pending" }).eq("id", order.id);
    order.status = "pending";
  }

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

export interface CustomerMatch {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  loyalty_points: number;
  tier: string;
}

const CUSTOMER_COLUMNS = "id, display_name, email, phone, loyalty_points, tier";

/**
 * Every account a phone number belongs to, wherever the shop has it written.
 *
 * A customer's number is rarely on their profile: someone who signed up on
 * the website typed it into a shipping address, and a WhatsApp regular's is
 * on the orders written down for them. So this looks in all four places --
 * profiles, saved addresses, order addresses, and the WhatsApp reference on
 * manual orders -- and ignores how the number was written (0812-3456-7890,
 * +62 812 3456 7890, 6281234567890 are one number).
 *
 * Ids come back best evidence first: the profile's own number, then a saved
 * address, then past orders, most recent first.
 */
async function customerIdsByPhone(
  supabase: Awaited<ReturnType<typeof adminClient>>["supabase"],
  typed: string,
): Promise<string[]> {
  if (phoneCore(typed).length < 4) return [];
  const pattern = phoneLikePattern(typed);

  const [profiles, addresses, orders] = await Promise.all([
    supabase.from("profiles").select("id, phone").ilike("phone", pattern).limit(50),
    supabase.from("addresses").select("user_id, phone").ilike("phone", pattern).limit(50),
    supabase
      .from("orders")
      .select("user_id, channel_reference, ship_phone:shipping_address->>phone")
      .not("user_id", "is", null)
      .or(`channel_reference.ilike.${pattern},shipping_address->>phone.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const ids: string[] = [];
  const add = (id: string | null | undefined) => {
    if (id && !ids.includes(id)) ids.push(id);
  };

  for (const row of (profiles.data ?? []) as { id: string; phone: string | null }[]) {
    if (phoneMatches(row.phone, typed)) add(row.id);
  }
  for (const row of (addresses.data ?? []) as { user_id: string; phone: string | null }[]) {
    if (phoneMatches(row.phone, typed)) add(row.user_id);
  }
  for (const row of (orders.data ?? []) as {
    user_id: string | null;
    channel_reference: string | null;
    ship_phone: string | null;
  }[]) {
    if (phoneMatches(row.ship_phone, typed) || phoneMatches(row.channel_reference, typed)) {
      add(row.user_id);
    }
  }
  return ids;
}

/** Profiles for these ids, in the order given. */
async function profilesInOrder(
  supabase: Awaited<ReturnType<typeof adminClient>>["supabase"],
  ids: string[],
): Promise<CustomerMatch[]> {
  if (!ids.length) return [];
  const { data } = await supabase.from("profiles").select(CUSTOMER_COLUMNS).in("id", ids);
  const rows = (data ?? []) as CustomerMatch[];
  return ids.flatMap((id) => rows.filter((row) => row.id === id));
}

/**
 * Customer lookup for attaching loyalty points and finding a saved address.
 *
 * Name, email or phone. Phone matters most for a chat order: the number is
 * the one thing about a WhatsApp customer the operator is certain of, so any
 * part of it, written any way, finds them.
 */
export async function findCustomers(query: string): Promise<CustomerMatch[]> {
  const { supabase } = await adminClient();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  // Mostly digits (with the usual +, spaces, dashes, dots, brackets): a number.
  const looksLikePhone = /^[\d\s+().-]+$/.test(trimmed) && phoneCore(trimmed).length >= 4;

  const byPhone = looksLikePhone
    ? await profilesInOrder(supabase, (await customerIdsByPhone(supabase, trimmed)).slice(0, 8))
    : [];

  // PostgREST's or() takes a comma-separated filter string, so a comma,
  // parenthesis or dot typed at the till would be parsed as syntax rather
  // than as text. Strip those, then escape LIKE wildcards.
  const safe = trimmed.replace(/[(),.*]/g, " ").trim();
  let byText: CustomerMatch[] = [];
  if (!looksLikePhone && safe.length >= 2) {
    const escaped = safe.replace(/[%_\\]/g, (match) => `\\${match}`);
    const { data } = await supabase
      .from("profiles")
      .select(CUSTOMER_COLUMNS)
      .or(`display_name.ilike.%${escaped}%,email.ilike.%${escaped}%`)
      .limit(8);
    byText = (data ?? []) as CustomerMatch[];
  }

  return [...byPhone, ...byText.filter((row) => !byPhone.some((hit) => hit.id === row.id))].slice(0, 8);
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

  const rows = (data ?? []) as Address[];
  if (rows.length) return rows;

  // Fallback: a customer with no rows in `addresses` may still have a
  // shipping address on a past order (guest checkout that was later attached
  // to their account, an operator-entered manual order that skipped the
  // save-address step). Reading the most recent non-null shipping_address
  // is a free source of "the place we posted to last time", which is what
  // an operator writing them a new order actually needs.
  const { data: lastOrder } = await supabase
    .from("orders")
    .select("id, shipping_address")
    .eq("user_id", userId)
    .not("shipping_address", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const shipping = (lastOrder as {
    id: string;
    shipping_address: Record<string, unknown> | null;
  } | null)?.shipping_address;
  if (!shipping) return [];

  const s = shipping as {
    recipient_name?: string;
    phone?: string;
    line1?: string;
    line2?: string | null;
    village?: string | null;
    district?: string | null;
    city?: string;
    province?: string | null;
    postal_code?: string | null;
    country?: string;
    area_id?: string | null;
  };

  // Synthesise an Address row so the caller does not have to distinguish
  // saved rows from order-snapshots. The id is namespaced so it is stable
  // across renders but obviously not a real addresses.id.
  const orderId = (lastOrder as { id: string }).id;
  const now = new Date().toISOString();
  return [
    {
      id: `last-order:${orderId}`,
      user_id: userId,
      recipient_name: s.recipient_name ?? "",
      phone: s.phone ?? "",
      line1: s.line1 ?? "",
      line2: s.line2 ?? null,
      village: s.village ?? null,
      district: s.district ?? null,
      city: s.city ?? "",
      province: s.province ?? null,
      postal_code: s.postal_code ?? null,
      country: s.country ?? "ID",
      area_id: s.area_id ?? null,
      is_default: true,
      created_at: now,
    } as Address,
  ];
}

/**
 * Every customer a whole phone number belongs to, best evidence first.
 * Searches profiles, saved addresses and past orders; see customerIdsByPhone.
 */
export async function findCustomersByPhone(phone: string): Promise<CustomerMatch[]> {
  const { supabase } = await adminClient();
  if (!isWholeNumber(phone)) return [];
  return profilesInOrder(supabase, (await customerIdsByPhone(supabase, phone)).slice(0, 5));
}

/**
 * The one customer a phone number belongs to, or null.
 *
 * Null as well when the number belongs to more than one account (a shared
 * family phone): picking one of them silently would put points and history on
 * the wrong person, so that choice is left to the operator.
 */
export async function findCustomerByPhone(phone: string): Promise<CustomerMatch | null> {
  const matches = await findCustomersByPhone(phone);
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Who a manual order might belong to: by phone if the number is known, and
 * by name only when it is not.
 *
 * Name matches are never attached by themselves -- three customers can be
 * called Fauzi -- they are offered for the operator to pick.
 */
export async function suggestCustomers(input: {
  phone?: string | null;
  name?: string | null;
}): Promise<{ byPhone: CustomerMatch[]; byName: CustomerMatch[] }> {
  const { supabase } = await adminClient();
  const phone = input.phone?.trim() ?? "";
  const byPhone = isWholeNumber(phone)
    ? await profilesInOrder(supabase, (await customerIdsByPhone(supabase, phone)).slice(0, 3))
    : [];
  if (byPhone.length) return { byPhone, byName: [] };

  const name = (input.name ?? "").replace(/[(),.*%_\\]/g, " ").replace(/\s+/g, " ").trim();
  if (name.length < 3) return { byPhone, byName: [] };
  const { data } = await supabase
    .from("profiles")
    .select(CUSTOMER_COLUMNS)
    .ilike("display_name", `%${name}%`)
    .limit(4);
  return { byPhone, byName: (data ?? []) as CustomerMatch[] };
}

/**
 * Create a customer record from the till or order page.
 *
 * Customers usually appear when they sign up on the website; this is the path
 * for the ones who never will -- a walk-in whose name was learned later, a
 * WhatsApp regular who has never touched the site. Phone is required (that is
 * how a WhatsApp customer is identifiable and what auto-suggest matches on),
 * email is optional.
 *
 * Supabase's admin API accepts either or both. If a profile already carries
 * this phone or email, we return that one instead of failing -- the operator
 * wanted "the customer with this number", and if one exists that IS them.
 */
export async function createCustomer(input: {
  displayName?: string | null;
  email?: string | null;
  phone: string;
}): Promise<{ id: string; display_name: string | null; email: string | null; phone: string | null }> {
  const { supabase } = await adminClient();

  const rawPhone = input.phone.trim();
  const rawEmail = input.email?.trim().toLowerCase() ?? "";
  const email = rawEmail || null;

  if (!rawPhone) {
    throw new Error("A customer needs a phone number.");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("That email address does not look right.");
  }

  // The number already belongs to someone -- on their profile, a saved
  // address or a past order, however it was written -- or the email does.
  // Whole numbers only: a fragment would "match" someone else's number.
  const byPhone = isWholeNumber(rawPhone)
    ? await profilesInOrder(supabase, await customerIdsByPhone(supabase, rawPhone))
    : [];
  let found: { id: string; display_name: string | null; email: string | null; phone: string | null } | undefined =
    byPhone[0];
  if (!found && email) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, display_name, email, phone")
      .eq("email", email)
      .limit(1);
    found = (existing ?? [])[0];
  }
  if (found) return found;

  const { data: normalised } = await supabase.rpc("normalise_loyalty_phone", {
    p_value: rawPhone,
  });
  const canonicalPhone = (normalised as string | null) ?? null;
  const digitsIntl = canonicalPhone?.replace(/[^0-9]/g, "") ?? "";
  const digitsLocal = digitsIntl.startsWith("62") ? `0${digitsIntl.slice(2)}` : digitsIntl;

  // Supabase's admin API takes email or phone (or both). Phone must be in
  // E.164 format, which is what the normaliser gives us as digits -- prefix
  // a + and it is valid. The operator vouches for both, so we mark them
  // confirmed to skip verification.
  const e164 = canonicalPhone ? `+${digitsIntl}` : rawPhone;

  const { data: created, error: authError } = await supabase.auth.admin.createUser({
    ...(email ? { email, email_confirm: true } : {}),
    phone: e164,
    phone_confirm: true,
    user_metadata: {
      full_name: input.displayName?.trim() || undefined,
    },
  });

  if (authError || !created?.user) {
    throw new Error(authError?.message ?? "Could not create the customer.");
  }

  await supabase
    .from("profiles")
    .update({
      display_name: input.displayName?.trim() || null,
      email: email,
      phone: digitsLocal || rawPhone,
    })
    .eq("id", created.user.id);

  return {
    id: created.user.id,
    display_name: input.displayName?.trim() || null,
    email: email,
    phone: digitsLocal || rawPhone,
  };
}
