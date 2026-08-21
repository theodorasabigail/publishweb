import "server-only";
import { env } from "@/lib/env";

/**
 * Resend audiences and broadcasts.
 *
 * The mailing list lives in two places on purpose. Supabase holds the record
 * of who signed up and when, because that is ours and must survive changing
 * email providers. Resend holds a copy as an "audience", because sending to a
 * list is a different job from keeping one: unsubscribes, bounces, suppression
 * and the legally required opt-out link all have to be handled by whoever
 * actually presses send, and doing that ourselves would put the domain that
 * carries order receipts at risk.
 *
 * So Supabase is the source of truth for membership, Resend is the sender, and
 * a sync pushes one into the other. If they ever disagree, Resend wins on
 * unsubscribes — someone who opted out there must never be re-added here.
 */

/* Overridable only so this can be pointed at a stand-in during testing. Unset
   in production, where it resolves to Resend. */
const API = process.env.RESEND_API_BASE ?? "https://api.resend.com";

interface ResendError {
  message?: string;
  name?: string;
}

async function call<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const key = env.optional("RESEND_API_KEY");
  if (!key) return { ok: false, error: "No Resend key is set." };

  try {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(15000),
    });

    const payload = (await response.json().catch(() => null)) as
      | (T & ResendError)
      | null;

    if (!response.ok) {
      return {
        ok: false,
        error: payload?.message ?? `Resend returned HTTP ${response.status}`,
      };
    }
    return { ok: true, data: payload as T };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not reach Resend",
    };
  }
}

// ---------------------------------------------------------------------------
// Audiences
// ---------------------------------------------------------------------------

export interface Audience {
  id: string;
  name: string;
}

export async function createAudience(name: string) {
  return call<Audience>("/audiences", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function listAudiences() {
  return call<{ data: Audience[] }>("/audiences");
}

/**
 * Add one address to the audience.
 *
 * Resend treats a repeated create as an update rather than an error, so this
 * is safe to call on every signup without checking first. It never sets
 * `unsubscribed: false` explicitly — doing so would silently resurrect someone
 * who had opted out, which is the one thing this must not do.
 */
export async function addContact(audienceId: string, email: string) {
  return call<{ id: string }>(`/audiences/${audienceId}/contacts`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

// ---------------------------------------------------------------------------
// Broadcasts
// ---------------------------------------------------------------------------

/**
 * Resend requires an unsubscribe link in every broadcast and substitutes this
 * token for a real one per recipient. It is not optional and not something to
 * be clever about: without it the send is rejected, and rightly.
 */
const UNSUBSCRIBE_TOKEN = "{{{RESEND_UNSUBSCRIBE_URL}}}";

export function broadcastFooter(): string {
  return `
    <hr style="margin:40px 0 20px;border:0;border-top:1px solid #e3ecee;">
    <p style="font-size:12px;line-height:1.6;color:#547680;">
      You are getting this because you signed up at Publish Coffee Roasters.
      <a href="${UNSUBSCRIBE_TOKEN}" style="color:#547680;">Unsubscribe</a>.
    </p>`;
}

export async function createBroadcast(input: {
  audienceId: string;
  from: string;
  subject: string;
  html: string;
  replyTo?: string;
}) {
  return call<{ id: string }>("/broadcasts", {
    method: "POST",
    body: JSON.stringify({
      audience_id: input.audienceId,
      from: input.from,
      subject: input.subject,
      html: input.html,
      reply_to: input.replyTo ? [input.replyTo] : undefined,
    }),
  });
}

export async function sendBroadcast(broadcastId: string) {
  return call<{ id: string }>(`/broadcasts/${broadcastId}/send`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
