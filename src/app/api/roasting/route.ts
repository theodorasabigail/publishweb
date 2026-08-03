import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  contact_name: z.string().min(1).max(120),
  contact_phone: z.string().min(5).max(40),
  email: z.string().email().max(200).optional().or(z.literal("")),
  green_bean_origin: z.string().min(1).max(200),
  quantity_kg: z.number().positive().max(100000),
  desired_roast_level: z.string().max(80).optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form — some details are missing." },
      { status: 400 },
    );
  }

  const session = await getSession();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("roasting_requests")
    .insert({
      user_id: session?.userId ?? null,
      contact_name: parsed.data.contact_name,
      contact_phone: parsed.data.contact_phone,
      email: parsed.data.email || session?.email || null,
      green_bean_origin: parsed.data.green_bean_origin,
      quantity_kg: parsed.data.quantity_kg,
      desired_roast_level: parsed.data.desired_roast_level || null,
      notes: parsed.data.notes || null,
    })
    .select("human_ref")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Could not send your request. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, reference: data.human_ref });
}
