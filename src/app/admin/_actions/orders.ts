"use server";

import { revalidatePath } from "next/cache";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";
import { sendOrderConfirmation, sendOrderShipped } from "@/lib/email/notify";
import { adminClient, optionalText, text } from "./guard";

export async function updateOrderStatus(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");
  const status = text(formData, "status") as OrderStatus;

  if (!ORDER_STATUSES.includes(status)) {
    throw new Error("Unknown order status.");
  }

  // Marking an order paid by hand must behave exactly like a webhook: same
  // stock decrement, same loyalty award, same idempotency.
  if (status === "paid") {
    const { error } = await supabase.rpc("mark_order_paid", {
      p_order_id: id,
      p_payment_ref: null,
      p_payment_method: "manual_admin",
    });
    if (error) throw new Error("Could not mark the order paid.");
    await sendOrderConfirmation(id);
  } else {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) throw new Error("Could not update the order.");

    // Covers marking an order shipped after the tracking number was already
    // saved. Guarded on the tracking number, so doing both in either order
    // still sends exactly one email.
    if (status === "shipped") await sendOrderShipped(id);
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath(`/order/${id}`);
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
