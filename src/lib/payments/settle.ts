import { createAdminClient } from "@/lib/supabase/admin";
import type { Order } from "@/lib/types";

/**
 * The one place an order becomes paid.
 *
 * Every provider funnels through here, and here funnels into the
 * `mark_order_paid` Postgres function, which is idempotent: a webhook that
 * fires twice sets the status once, decrements stock once, and awards loyalty
 * points once.
 */

type Supabase = ReturnType<typeof createAdminClient>;

export async function recordPaymentEvent(input: {
  provider: string;
  externalId: string | null;
  amountIdr: number | null;
  status: string;
  matchedOrderId?: string | null;
  isMatched: boolean;
  payload: unknown;
}): Promise<void> {
  const supabase = createAdminClient();
  // Duplicate webhook deliveries collide on (provider, external_id) and are
  // dropped rather than filling the admin's queue with noise.
  await supabase.from("payment_events").upsert(
    {
      provider: input.provider,
      external_id: input.externalId,
      amount_idr: input.amountIdr,
      status: input.status,
      matched_order_id: input.matchedOrderId ?? null,
      is_matched: input.isMatched,
      is_resolved: input.isMatched,
      payload: input.payload as never,
    },
    { onConflict: "provider,external_id", ignoreDuplicates: true },
  );
}

export async function findOrderByHumanRef(
  supabase: Supabase,
  humanRef: string,
): Promise<Order | null> {
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("human_ref", humanRef)
    .maybeSingle();
  return (data as Order | null) ?? null;
}

/** Match an incoming bank credit to the one pending order with that exact
 *  total. Path B's whole reconciliation strategy rests on this being unique,
 *  which `resolveTotal` guarantees when it allocates the unique code. */
export async function findPendingOrderByAmount(
  supabase: Supabase,
  amountIdr: number,
): Promise<Order | null> {
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "pending")
    .eq("total_idr", amountIdr)
    .order("created_at", { ascending: true })
    .limit(2);

  const matches = (data ?? []) as Order[];
  // Two pending orders at one amount means the code allocation was bypassed;
  // refuse to guess and let the admin resolve it from the unmatched queue.
  if (matches.length !== 1) return null;
  return matches[0];
}

export async function settleOrder(
  supabase: Supabase,
  orderId: string,
  reference: string | null,
  method: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("mark_order_paid", {
    p_order_id: orderId,
    p_payment_ref: reference,
    p_payment_method: method,
  });

  if (error) {
    console.error("mark_order_paid failed", { orderId, error });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function cancelOrder(
  supabase: Supabase,
  orderId: string,
  reason: string,
): Promise<void> {
  // Only an unpaid order may be cancelled by a webhook; a late "expired"
  // callback must never undo a payment that already landed.
  await supabase
    .from("orders")
    .update({ status: "cancelled", courier_note: reason })
    .eq("id", orderId)
    .is("paid_at", null);
}
