"use server";

import { revalidatePath } from "next/cache";
import { ROASTING_STATUSES, type RoastingStatus } from "@/lib/types";
import { adminClient, optionalInteger, optionalText, text } from "./guard";

export async function updateRoastingRequest(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");
  const status = text(formData, "status") as RoastingStatus;

  if (!ROASTING_STATUSES.includes(status)) {
    throw new Error("Unknown request status.");
  }

  await supabase
    .from("roasting_requests")
    .update({
      status,
      quoted_price_idr: optionalInteger(formData, "quoted_price_idr"),
      admin_note: optionalText(formData, "admin_note"),
    })
    .eq("id", id);

  revalidatePath("/admin/roasting");
}
