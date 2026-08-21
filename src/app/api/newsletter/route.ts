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

  const email = parsed.data.email.toLowerCase();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("newsletter_subscribers")
    .upsert(
      { email, source: parsed.data.source ?? null },
      { onConflict: "email", ignoreDuplicates: true },
    );

  if (error) {
    return NextResponse.json(
      { error: "Could not save that right now. Try again shortly." },
      { status: 500 },
    );
  }

  // Mirror into Resend so the list is ready to send to without anyone
  // remembering to press sync. Deliberately after the row is safely stored and
  // deliberately unable to fail the request: the signup succeeded the moment
  // Supabase accepted it, and a Resend outage must not tell a visitor
  // otherwise. Anything missed here is picked up by the sync button, which is
  // exactly why that button still exists.
  await mirrorToResend(supabase, email);

  return NextResponse.json({ ok: true });
}

async function mirrorToResend(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<void> {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("resend_audience_id")
      .eq("id", true)
      .maybeSingle();

    const audienceId = (data as { resend_audience_id: string | null } | null)
      ?.resend_audience_id;
    if (!audienceId) return;

    const { addContact } = await import("@/lib/email/audience");
    const result = await addContact(audienceId, email);
    if (!result.ok) {
      console.warn(`newsletter: could not mirror ${email} to Resend — ${result.error}`);
      return;
    }

    await supabase
      .from("newsletter_subscribers")
      .update({ synced_at: new Date().toISOString() })
      .eq("email", email);
  } catch (error) {
    console.warn("newsletter: mirroring to Resend threw", error);
  }
}
