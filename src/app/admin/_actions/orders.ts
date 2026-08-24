"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CHANNEL_LABELS,
  ORDER_STATUSES,
  addressIsComplete,
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

  // updateOrderStatus is fulfilment only now. `paid` moved out into its own
  // action (markOrderPaid), and this refuses it defensively -- an operator
  // whose bookmark points at old code should not accidentally revert an
  // order's fulfilment progress by picking a status that no longer exists.
  if ((status as string) === "paid") {
    throw new Error(
      "Payment is recorded separately now. Use the 'Mark paid' button below the fulfilment status.",
    );
  }

  if (status === "cancelled") {
    // Cancelling has to put back any stock the order was holding, or a
    // WhatsApp order that fell through keeps that coffee off the website
    // forever. Only the *hold* comes back: once an order has been paid the
    // coffee has left the building, and reversing that is a refund and a
    // fresh stock count, not a status change.
    const { error } = await supabase.rpc("cancel_order", { p_order_id: id });
    if (error) throw new Error("Could not cancel the order.");
  } else {
    // An order that has stopped merely waiting has its coffee spoken for.
    //
    // Stock used to move at exactly one moment — payment — which was right
    // when the website was the only path. Driven by hand it leaves a gap: an
    // order being roasted is an order somebody is roasting beans for, and the
    // shop would go on selling those bags until the transfer landed.
    //
    // Holding rather than decrementing, because no money has arrived yet.
    // When it does, mark_order_paid turns the hold into a real decrement; if
    // the order is cancelled instead, the hold comes back. Both already work.
    // Paid orders are left alone by the function itself, so re-selecting a
    // status on one cannot take the same bags off twice.
    if (status === "roasting" || status === "packing" || status === "shipped" || status === "delivered") {
      const { error } = await supabase.rpc("reserve_order_stock", { p_order_id: id });
      // The function names the coffee that is short, which is the only version
      // of this message the operator can act on.
      if (error) {
        throw new Error(describeDbError(error, error.message ?? "Could not set the coffee aside."));
      }
    }

    // ...and a step back to "waiting" un-commits it, so an order parked back
    // in pending does not go on holding coffee nobody is working on.
    if (status === "pending") {
      const { error } = await supabase.rpc("release_order_stock", { p_order_id: id });
      if (error) throw new Error(describeDbError(error, "Could not release the coffee."));
    }

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
  // Any of these moves what the shop can sell, so the storefront's stock
  // counts are now stale.
  revalidatePath("/");
  revalidatePath("/shop");
}

/**
 * Record how an order is going out.
 *
 * Saving a tracking number *is* shipping the order, so it says so. It used to
 * email the customer that their parcel was on its way while leaving the order
 * reading "paid" in the admin with no despatch date — the one person who could
 * answer "did that go out?" was the last to be told.
 *
 * Only ever forwards: an order already completed is not walked back to
 * shipped, and a despatch date corrected by hand is not overwritten by the
 * moment the form was saved.
 */
/**
 * Record a payment against an order.
 *
 * The counterpart to the status dropdown after 0037 -- payment lives on its
 * own axis, not as a value in the fulfilment enum. All the behaviour that
 * used to happen when the status dropdown was set to "paid" happens here:
 * stock decrement, points award (direct or bucketed), receipt email,
 * pending-hold release. Idempotent -- calling on an already-paid order is a
 * no-op that just returns the current state.
 */
export async function markOrderPaid(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");
  const method = optionalText(formData, "payment_method") ?? "manual_admin";

  const { error } = await supabase.rpc("mark_order_paid", {
    p_order_id: id,
    p_payment_ref: null,
    p_payment_method: method,
  });
  if (error) throw new Error(describeDbError(error, "Could not mark the order paid."));

  await sendOrderConfirmation(id);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/shop");
}

/**
 * Mark that an invoice was sent for this order.
 *
 * Independent of paid_at, deliberately: some invoices go before payment (net
 * terms), some go after ("we already have your money, here's the paper"),
 * and some never go at all (retail counter sales). A timestamp is enough --
 * receipts and invoices are the same document in this shop, and marking that
 * one was sent is what the accounts side of the workflow wants to see.
 *
 * Reversible: calling with p_undo=true clears the flag, so an invoice sent
 * to the wrong customer can be un-marked.
 */
export async function markOrderInvoiced(formData: FormData) {
  const { supabase, session } = await adminClient();
  const id = text(formData, "id");
  const undo = text(formData, "undo") === "true";

  const { error } = await supabase
    .from("orders")
    .update(
      undo
        ? { invoiced_at: null, invoiced_by: null }
        : { invoiced_at: new Date().toISOString(), invoiced_by: session.userId },
    )
    .eq("id", id);
  if (error) throw new Error(describeDbError(error, "Could not update the invoice status."));

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
}

export async function updateOrderFulfilment(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");
  const tracking = optionalText(formData, "tracking_number");

  const { data: existing } = await supabase
    .from("orders")
    .select("status, shipped_at, shipping_address")
    .eq("id", id)
    .maybeSingle();
  const before = existing as {
    status: OrderStatus;
    shipped_at: string | null;
    shipping_address: ShippingAddressSnapshot | null;
  } | null;

  // An order can be saved with half an address, or none. It cannot be *posted*
  // to one: a tracking number says a parcel has gone somewhere, and it cannot
  // have gone somewhere that is not written down.
  if (tracking && !addressIsComplete(before?.shipping_address)) {
    throw new Error(
      "This order needs a full address before it can be given a tracking number — " +
        "a name, a phone number, a street and a city. Add them under “Correct the details”.",
    );
  }

  const patch: {
    tracking_number: string | null;
    courier_note: string | null;
    status?: OrderStatus;
    shipped_at?: string;
  } = {
    tracking_number: tracking,
    courier_note: optionalText(formData, "courier_note"),
  };

  if (tracking && before) {
    // "Completed" and "cancelled" are both past "shipped"; nothing else is.
    const notYetShipped = ["pending", "paid", "roasting"].includes(before.status);
    if (notYetShipped) patch.status = "shipped";
    if (!before.shipped_at) patch.shipped_at = new Date().toISOString();
  }

  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) throw new Error(describeDbError(error, "Could not save the shipping details."));

  await sendOrderShipped(id);

  revalidatePath("/admin/orders");
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
    .select("paid_at, subtotal_idr, unique_code")
    .eq("id", id)
    .maybeSingle();
  const currentOrder = current as {
    paid_at: string | null;
    subtotal_idr: number;
    unique_code: number;
  } | null;
  const wasPaid = Boolean(currentOrder?.paid_at);

  // Money edits happen next, and touch the total. Kept apart from the payment
  // path -- nothing here moves stock or points.
  const rawShipping = optionalText(formData, "shipping_idr");
  const rawDiscount = optionalText(formData, "discount_idr");
  const shippingIdr = rawShipping ? Math.max(0, Math.round(Number(rawShipping))) : null;
  const discountIdrRaw = rawDiscount ? Math.max(0, Math.round(Number(rawDiscount))) : null;
  // A discount larger than the coffee is read as "this one is free" rather
  // than allowed to go negative, matching how the till handles the same case.
  const discountIdr = discountIdrRaw !== null && currentOrder
    ? Math.min(discountIdrRaw, currentOrder.subtotal_idr)
    : discountIdrRaw;
  const discountReason = optionalText(formData, "discount_reason");

  if ((discountIdr ?? 0) > 0 && !discountReason) {
    throw new Error("Say what the discount is for.");
  }

  // When the order was actually agreed, which for one written up days later
  // is not when it was typed in. Refused if it is in the future: a sale that
  // has not happened yet is always a slip of the keyboard, and it would sort
  // to the top of every list until the date came round.
  const placedAt = fromShopDateTimeInput(optionalText(formData, "created_at"));
  if (placedAt && Date.parse(placedAt) > Date.now()) {
    throw new Error("An order cannot have been placed in the future.");
  }

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

  // A part-written address is saved as it stands. It is how an order whose
  // address is still coming gets recorded at all, and `addressIsComplete`
  // guards the one place it would actually matter — putting a parcel in the
  // post. An address with nothing on it at all is null, which reads as "the
  // customer is collecting".
  const recipient = optionalText(formData, "recipient_name");
  const hasAnything = [
    recipient,
    optionalText(formData, "phone"),
    optionalText(formData, "line1"),
    optionalText(formData, "city"),
    optionalText(formData, "village"),
    optionalText(formData, "district"),
    optionalText(formData, "postal_code"),
  ].some(Boolean);

  const address: ShippingAddressSnapshot | null = hasAnything
    ? {
        recipient_name: recipient ?? "",
        phone: text(formData, "phone"),
        email: optionalText(formData, "email"),
        line1: text(formData, "line1"),
        line2: optionalText(formData, "line2"),
        village: optionalText(formData, "village"),
        district: optionalText(formData, "district"),
        city: text(formData, "city"),
        province: optionalText(formData, "province"),
        postal_code: optionalText(formData, "postal_code"),
        country: text(formData, "country") || "ID",
        // Carried through rather than re-derived: it identifies the place the
        // customer actually picked, and a hand-edit to the words around it is
        // handled by the form, which clears this when they no longer agree.
        area_id: optionalText(formData, "area_id"),
      }
    : null;

  const { error } = await supabase
    .from("orders")
    .update({
      channel,
      channel_reference: optionalText(formData, "channel_reference"),
      ...(placedAt ? { created_at: placedAt } : {}),
      paid_at: paidAt,
      // Money edits: never negative, discount capped at the coffee subtotal
      // (already done above), and the total is kept consistent with its parts.
      // Any of the three left empty means "clear" -- an operator who removes
      // a value expects that value to be gone.
      shipping_idr: shippingIdr ?? 0,
      discount_idr: discountIdr ?? 0,
      discount_reason: (discountIdr ?? 0) > 0 ? discountReason : null,
      total_idr: Math.max(
        0,
        (currentOrder?.subtotal_idr ?? 0)
          - (discountIdr ?? 0)
          + (shippingIdr ?? 0)
          + (currentOrder?.unique_code ?? 0),
      ),
      // A plain YYYY-MM-DD date, or null to clear. A malformed one is dropped
      // rather than saved as a bad date -- a date input from a modern browser
      // is validated already, so this is a belt to the browser's braces.
      ship_after: /^\d{4}-\d{2}-\d{2}$/.test(optionalText(formData, "ship_after") ?? "")
        ? optionalText(formData, "ship_after")
        : null,
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

/**
 * Attach a customer to an order that was written without one, or move it to a
 * different customer, or detach entirely.
 *
 * The database function does the work: it sets user_id, and -- crucially --
 * transfers any pending-loyalty points sitting against the order's email or
 * phone into the newly-attached customer's balance through the ledger. Without
 * that transfer the account and the ledger would disagree on what the customer
 * earned, which the operator would notice weeks later and could not explain.
 *
 * A no-op when the same customer is chosen again, so a save-then-save cannot
 * double-award points.
 */
export async function assignOrderCustomer(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");
  const userId = optionalText(formData, "user_id");

  const { error } = await supabase.rpc("assign_order_customer", {
    p_order_id: id,
    p_user_id: userId,
  });
  if (error) throw new Error(describeDbError(error, "Could not attach the customer."));

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/customers");
  if (userId) revalidatePath(`/admin/customers/${userId}`);
}

/**
 * Add shipping and mark an order paid in one step.
 *
 * The common case for a manual order: it was written up before postage was
 * agreed, and now the money has landed. Right now that is three trips --
 * corrections panel to add shipping, then the status form to mark paid, then
 * a refresh -- and the shipping edit is trivial each time. This is that
 * flow, condensed. Reuses mark_order_paid, so stock, points and the receipt
 * email land in the same place.
 *
 * Refuses to run on an already-paid order (the corrections panel handles
 * that), and refuses to add shipping when there is no address to ship to.
 */
export async function quickShipAndPay(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");
  const shippingRaw = optionalText(formData, "shipping_idr");
  const shippingIdr = shippingRaw ? Math.max(0, Math.round(Number(shippingRaw))) : 0;
  const method = optionalText(formData, "payment_method") ?? "manual_admin";

  const { data: current } = await supabase
    .from("orders")
    .select("paid_at, subtotal_idr, discount_idr, unique_code, shipping_address")
    .eq("id", id)
    .maybeSingle();
  const order = current as {
    paid_at: string | null;
    subtotal_idr: number;
    discount_idr: number;
    unique_code: number;
    shipping_address: unknown;
  } | null;

  if (!order) throw new Error("That order no longer exists.");
  if (order.paid_at) {
    throw new Error(
      "This order has already been paid. Use the corrections panel to change shipping.",
    );
  }

  // Apply shipping and total first, then settle. If the settle fails, the
  // shipping edit stays -- the operator can retry marking paid without
  // re-typing.
  const { error: writeError } = await supabase
    .from("orders")
    .update({
      shipping_idr: shippingIdr,
      total_idr: Math.max(
        0,
        (order.subtotal_idr ?? 0) - (order.discount_idr ?? 0) + shippingIdr + (order.unique_code ?? 0),
      ),
    })
    .eq("id", id);

  if (writeError) {
    throw new Error(describeDbError(writeError, "Could not save the shipping cost."));
  }

  const { error: payError } = await supabase.rpc("mark_order_paid", {
    p_order_id: id,
    p_payment_ref: null,
    p_payment_method: method,
  });
  if (payError) throw new Error(describeDbError(payError, "Could not mark the order paid."));

  await sendOrderConfirmation(id);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin");
}
