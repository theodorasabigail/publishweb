"use server";

import { revalidatePath } from "next/cache";
import {
  addContact,
  broadcastFooter,
  createAudience,
  createBroadcast,
  sendBroadcast,
} from "@/lib/email/audience";
import { renderMarkdown } from "@/lib/markdown";
import { env } from "@/lib/env";
import { adminClient, text } from "./guard";

type Result = { ok: boolean; message: string };

/**
 * Create the Resend audience and remember it.
 *
 * Stored in site_settings rather than an environment variable, deliberately.
 * Everything set from a dashboard button should be recorded by that button —
 * making the operator copy an identifier into Vercel and redeploy, for
 * something they just created by clicking, is the step that goes wrong.
 */
export async function connectAudience(): Promise<Result> {
  const { supabase } = await adminClient();

  if (!env.optional("RESEND_API_KEY")) {
    return {
      ok: false,
      message:
        "No Resend key is set. Add RESEND_API_KEY in Vercel and redeploy first — the same key the order receipts use.",
    };
  }

  const created = await createAudience("Publish Coffee Roasters");
  if (!created.ok) return { ok: false, message: created.error };

  await supabase
    .from("site_settings")
    .update({ resend_audience_id: created.data.id })
    .eq("id", true);

  revalidatePath("/admin/customers/subscribers");
  return { ok: true, message: "Connected. Now sync your subscribers across." };
}

/**
 * Push subscribers into the Resend audience.
 *
 * Only ones not sent before, tracked per row, so this is cheap to press twice
 * and does not re-add anyone who has since unsubscribed in Resend — re-adding
 * an opt-out is the one genuinely harmful thing a sync can do.
 *
 * Marked as synced only on success, so a failure halfway through leaves the
 * rest to be picked up next time rather than silently skipped.
 */
export async function syncSubscribers(): Promise<Result> {
  const { supabase } = await adminClient();

  const { data: settings } = await supabase
    .from("site_settings")
    .select("resend_audience_id")
    .eq("id", true)
    .maybeSingle();

  const audienceId = (settings as { resend_audience_id: string | null } | null)
    ?.resend_audience_id;
  if (!audienceId) {
    return { ok: false, message: "Connect the audience first." };
  }

  const { data } = await supabase
    .from("newsletter_subscribers")
    .select("id, email")
    .is("synced_at", null)
    .limit(500);

  const pending = (data ?? []) as { id: string; email: string }[];
  if (!pending.length) {
    return { ok: true, message: "Everyone is already synced." };
  }

  let sent = 0;
  const failures: string[] = [];

  // One at a time rather than in parallel: Resend rate-limits, and a burst of
  // 500 requests would be throttled into failures that look like real errors.
  for (const subscriber of pending) {
    const result = await addContact(audienceId, subscriber.email);
    if (result.ok) {
      await supabase
        .from("newsletter_subscribers")
        .update({ synced_at: new Date().toISOString() })
        .eq("id", subscriber.id);
      sent += 1;
    } else {
      failures.push(result.error);
      // Stop on the first failure. Continuing through a rate limit or a bad
      // key just produces 499 more of the same error.
      break;
    }
  }

  revalidatePath("/admin/customers/subscribers");

  if (failures.length) {
    return {
      ok: sent > 0,
      message:
        `${sent} synced, then Resend said: ${failures[0]}. ` +
        "Press sync again to carry on from where it stopped.",
    };
  }
  return { ok: true, message: `${sent} ${sent === 1 ? "address" : "addresses"} synced to Resend.` };
}

/**
 * Write one and send it.
 *
 * Resend does the sending, which means it also does the unsubscribe link,
 * suppression and bounce handling — the parts that, done badly, get a domain
 * blocked for the order receipts that actually matter. That is the whole
 * reason this posts to Resend rather than looping over addresses itself.
 */
export async function sendNewsletter(formData: FormData): Promise<Result> {
  const { supabase } = await adminClient();

  const subject = text(formData, "subject");
  const body = text(formData, "body");

  if (!subject) return { ok: false, message: "Give it a subject line." };
  if (!body) return { ok: false, message: "There is nothing to send." };

  const from = env.optional("EMAIL_FROM");
  if (!from) {
    return {
      ok: false,
      message: "EMAIL_FROM is not set in Vercel, so there is no address to send from.",
    };
  }

  const { data } = await supabase
    .from("site_settings")
    .select("resend_audience_id, contact_email")
    .eq("id", true)
    .maybeSingle();

  const settings = data as
    | { resend_audience_id: string | null; contact_email: string | null }
    | null;

  if (!settings?.resend_audience_id) {
    return { ok: false, message: "Connect the audience first." };
  }

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.65;color:#0f2024;max-width:560px;margin:0 auto;padding:24px;">
      ${renderMarkdown(body)}
      ${broadcastFooter()}
    </div>`;

  const created = await createBroadcast({
    audienceId: settings.resend_audience_id,
    from,
    subject,
    html,
    replyTo: settings.contact_email ?? undefined,
  });
  if (!created.ok) return { ok: false, message: created.error };

  const sent = await sendBroadcast(created.data.id);
  if (!sent.ok) {
    return {
      ok: false,
      message: `Written but not sent: ${sent.error}. It is saved as a draft in your Resend dashboard.`,
    };
  }

  revalidatePath("/admin/customers/subscribers");
  return { ok: true, message: "Sent. Resend is delivering it now." };
}
