import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email().max(200),
  source: z.string().max(60).optional(),
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
    return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("newsletter_subscribers")
    .upsert(
      { email: parsed.data.email.toLowerCase(), source: parsed.data.source ?? null },
      { onConflict: "email", ignoreDuplicates: true },
    );

  if (error) {
    return NextResponse.json(
      { error: "Could not save that right now. Try again shortly." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
