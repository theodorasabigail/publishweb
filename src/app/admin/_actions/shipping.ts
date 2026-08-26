"use server";

import { revalidatePath } from "next/cache";
import {
  bookBiteshipForOrder,
  quoteBiteshipForOrder,
  type BookableOption,
} from "@/lib/shipping/biteship-booking";
import { adminClient } from "./guard";

/**
 * Admin-facing server actions for one-click Biteship booking.
 *
 * These are wrappers: the real work is in biteship-booking.ts. They exist so
 * the page can call them as form actions and useTransition, and so the
 * revalidatePath / auth guard stays in one place.
 */

export async function fetchBiteshipOptionsForOrder(
  orderId: string,
): Promise<
  | { ok: true; options: BookableOption[] }
  | { ok: false; reason: string }
> {
  const { supabase } = await adminClient();
  return quoteBiteshipForOrder(supabase, orderId);
}

export async function bookBiteshipShipment(
  orderId: string,
  courierCompany: string,
  courierService: string,
): Promise<{ ok: true; courierOrderId: string } | { ok: false; reason: string }> {
  const { supabase } = await adminClient();

  if (!courierCompany || !courierService) {
    return { ok: false, reason: "Pick a courier and service before booking." };
  }

  const result = await bookBiteshipForOrder(
    supabase,
    orderId,
    courierCompany,
    courierService,
  );

  if (!result.ok) return result;

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/order/${orderId}`);

  return { ok: true, courierOrderId: result.created.courierOrderId };
}
