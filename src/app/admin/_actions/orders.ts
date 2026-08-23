"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CHANNEL_LABELS,
  ORDER_STATUSES,
  type OrderStatus,
  type SalesChannel,
  type ShippingAddressSnapshot,
} from "@/lib/types";
import { sendOrderConfirmation, sendOrderShipped } from "@/lib/email/notify";
import { fromShopDateTimeInput } from "@/lib/utils";
import { adminClient, describeDbError, optionalText, text } from "./guard";

export async function updateOrderStatus(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");
  const status = text(formData, "status") as OrderStatus;

  if (!ORDER_STATUSES.includes(status)) {
    throw new Error("Unknown order status.");
  }

  // Marking an order paid by hand must behave exactly like a webhook: same
  // stock decrement, same loyalty award, same idempotency. On a manual order
  // it is also what turns a hold on stock into a real decrement.
  if (status === "paid") {
    const { error } = await supabase.rpc("mark_order_paid", {
      p_order_id: id,
      p_payment_ref: null,
      p_payment_method: "manual_admin",
    });
    if (error) throw new Error("Could not mark the order paid.");
    await sendOrderConfirmation(id);
  } else if (status === "cancelled") {
    // Cancelling has to put back any stock the order was holding, or a
    // WhatsApp order that fell through keeps that coffee off the website
    // forever. Only the *hold* comes back: once an order has been paid the
    // coffee has left the building, and reversing that is a refund and a
    // fresh stock count, not a status change.
    const { error } = await supabase.rpc("cancel_order", { p_order_id: id });
    if (error) throw new Error("Could not cancel the order.");
  } else {
    // Marking an order shipped records when, if nothing has yet. Only when it
    // is missing: re-selecting "shipped" on an order that already shipped
    // must not move the date to today, and a date the operator corrected by
    // hand is more accurate than the moment they clicked the dropdown.
    const patch: { status: OrderStatus; shipped_at?: string } = { status };
    if (status === "shipped") {
      const { data: existing } = await supabase
        .from("orders")
        .select("shipped_at")
        .eq("id", id)
        .maybeSingle();
      if (!(existing as { shipped_at: string | null } | null)?.shipped_at) {
        patch.shipped_at = new Date().toISOString();
      }
    }

    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) throw new Error(describeDbError(error, "Could not update the order."));

    // Covers marking an order shipped after the tracking number was already
    // saved. Guarded on the tracking number, so doing both in either order
    // still sends exactly one email.
    if (status === "shipped") await sendOrderShipped(id);
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath(`/order/${id}`);
  // Paying or cancelling moves what the shop can sell, so the storefront's
  // stock counts are now stale.
  revalidatePath("/");
  revalidatePath("/shop");
}

export async function updateOrderFulfilment(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");

  await supabase
    .from("orders")
    .update({
      tracking_number: optionalText(formData, "tracking_number"),
      courier_note: optionalText(formData, "courier_note"),
    })
    .eq("id", id);

  await sendOrderShipped(id);

  revalidatePath(`/admin/orders/${id}`);
  revalidatePath(`/order/${id}`);
}

/**
 * Correct the details of an order that has already been written.
 *
 * Everything here is bookkeeping: which conversation an order came from, the
 * address it is going to, and the two dates that matter — when the money
 * arrived and when the parcel left. None of it moves stock, money or loyalty
 * points, and that is the line this action does not cross.
 *
 * `paid_at` is the one that could. Setting it on an order that was never paid
 * would produce an order that looks settled while its stock is still on the
 * shelf and its points were never awarded, so that case is refused here and
 * the operator is pointed at the status control, which does the real work. A
 * *correction* to an already-paid order's date is only a correction, and is
 * allowed.
 */
export async function updateOrderDetails(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");

  const channel = text(formData, "channel") as SalesChannel;
  if (!(channel in CHANNEL_LABELS)) {
    throw new Error("Unknown sales channel.");
  }

  const { data: current } = await supabase
    .from("orders")
    .select("paid_at")
    .eq("id", id)
    .maybeSingle();
  const wasPaid = Boolean((current as { paid_at: string | null } | null)?.paid_at);

  const paidAt = fromShopDateTimeInput(optionalText(formData, "paid_at"));
  if (paidAt && !wasPaid) {
    throw new Error(
      "This order has not been paid yet, so it has no payment date to correct. " +
        "Use the status control to mark it paid — that takes the stock down and " +
        "awards points, which typing a date here would not.",
    );
  }
  if (!paidAt && wasPaid) {
    throw new Error(
      "An order that has been paid cannot have its payment date removed. " +
        "If it was marked paid by mistake, cancel it instead.",
    );
  }

  // An address is either recorded in full or not at all. A half-written one is
  // worse than none: the courier form would silently take it.
  const recipient = optionalText(formData, "recipient_name");
  const address: ShippingAddressSnapshot | null = recipient
    ? {
        recipient_name: recipient,
        phone: text(formData, "phone"),
        email: optionalText(formData, "email"),
        line1: text(formData, "line1"),
        line2: optionalText(formData, "line2"),
        city: text(formData, "city"),
        province: optionalText(formData, "province"),
        postal_code: optionalText(formData, "postal_code"),
        country: text(formData, "country") || "ID",
      }
    : null;

  if (address && (!address.phone || !address.line1 || !address.city)) {
    throw new Error("An address needs at least a phone number, a street and a city.");
  }

  const { error } = await supabase
    .from("orders")
    .update({
      channel,
      channel_reference: optionalText(formData, "channel_reference"),
      paid_at: paidAt,
      shipped_at: fromShopDateTimeInput(optionalText(formData, "shipped_at")),
      shipping_address: address,
    })
    .eq("id", id);

  if (error) throw new Error(describeDbError(error, "Could not save the corrections."));

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath(`/order/${id}`);
  // The channel a sale is filed under changes what the reports say.
  revalidatePath("/admin/reports");
}

/**
 * Undo an order that was entered wrong.
 *
 * "Cancelled" and "voided" say different things and this is the second one.
 * Cancelled means the order was real and is not going ahead; voided means it
 * was never real — the wrong coffee rung up, a WhatsApp order entered twice —
 * so leaving it in the day's takings misreports the day.
 *
 * The reversal is the database's job, in one transaction: release any hold,
 * put the coffee back if it had been paid for, take the points back through
 * the ledger so the customer's history still adds up. Restoring re-applies
 * all of it, which is what makes voiding safe to reach for.
 */
export async function voidOrder(formData: FormData) {
  const { supabase, session } = await adminClient();
  const id = text(formData, "id");

  const { error } = await supabase.rpc("void_order", {
    p_order_id: id,
    p_reason: optionalText(formData, "reason"),
    p_by: session.userId,
  });

  // The function's own messages explain what it refused and why, so they go
  // through unchanged rather than being flattened into something generic.
  if (error) throw new Error(describeDbError(error, error.message ?? "Could not void the order."));

  revalidateOrder(id);
}

/** Put a voided order back, stock and points with it. */
export async function restoreOrder(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");

  const { error } = await supabase.rpc("restore_order", { p_order_id: id });
  if (error) {
    throw new Error(describeDbError(error, error.message ?? "Could not restore the order."));
  }

  revalidateOrder(id);
}

/**
 * Remove a voided order for good.
 *
 * Guarded twice over: the database refuses unless the order is already voided
 * (so its stock and points are already back), and the operator has to type the
 * order's reference to confirm. There is no undo past this point, which is
 * exactly why it asks.
 */
export async function deleteOrder(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");

  const { data: order } = await supabase
    .from("orders")
    .select("human_ref")
    .eq("id", id)
    .maybeSingle();

  const reference = (order as { human_ref: string } | null)?.human_ref;
  if (!reference) throw new Error("That order no longer exists.");

  if (text(formData, "confirm").toUpperCase() !== reference.toUpperCase()) {
    throw new Error(
      `To delete this order for good, type its reference — ${reference} — into the box.`,
    );
  }

  const { error } = await supabase.rpc("delete_order", { p_order_id: id });
  if (error) {
    throw new Error(describeDbError(error, error.message ?? "Could not delete the order."));
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/shop");
  // The order's own page is gone, so there is nowhere to go back to.
  redirect("/admin/orders");
}

/** Everywhere an order's existence or stock is reflected. */
function revalidateOrder(id: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath(`/order/${id}`);
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/shop");
}
