"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const addressSchema = z.object({
  recipient_name: z.string().min(1).max(120),
  phone: z.string().min(5).max(40),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(120),
  province: z.string().max(120).optional(),
  postal_code: z.string().max(20).optional(),
  country: z.string().min(2).max(20),
  is_default: z.boolean(),
});

export async function saveAddress(formData: FormData): Promise<void> {
  const session = await requireUser("/account/addresses");

  const parsed = addressSchema.safeParse({
    recipient_name: formData.get("recipient_name"),
    phone: formData.get("phone"),
    line1: formData.get("line1"),
    line2: formData.get("line2") || undefined,
    city: formData.get("city"),
    province: formData.get("province") || undefined,
    postal_code: formData.get("postal_code") || undefined,
    country: formData.get("country"),
    is_default: formData.get("is_default") === "on",
  });

  // The form marks every required field, so a failure here means a crafted
  // request rather than a mistake worth reporting back to the customer.
  if (!parsed.success) return;

  // RLS confines this to the signed-in user's own rows.
  const supabase = await createClient();
  const { error } = await supabase
    .from("addresses")
    .insert({ ...parsed.data, user_id: session.userId });

  if (error) return;

  revalidatePath("/account/addresses");
}

export async function deleteAddress(formData: FormData) {
  await requireUser("/account/addresses");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("addresses").delete().eq("id", id);
  revalidatePath("/account/addresses");
}

export async function makeDefaultAddress(formData: FormData) {
  await requireUser("/account/addresses");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("addresses").update({ is_default: true }).eq("id", id);
  revalidatePath("/account/addresses");
}
