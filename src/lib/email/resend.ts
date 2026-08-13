import { env } from "@/lib/env";
import type { EmailMessage, EmailProvider, EmailResult } from "./types";

/**
 * Resend (https://resend.com).
 *
 * Chosen because the free tier covers far more than this shop will send, the
 * setup is one API key plus DNS records, and there is no sales call. Swapping
 * to Postmark, SendGrid or anything else means another file implementing
 * EmailProvider — nothing that sends email needs to change.
 */
export const resendProvider: EmailProvider = {
  id: "resend",
  label: "Resend",

  async send(message: EmailMessage): Promise<EmailResult> {
    const key = env.optional("RESEND_API_KEY");
    const from = env.optional("EMAIL_FROM");

    if (!key || !from) {
      return { ok: false, error: "RESEND_API_KEY or EMAIL_FROM is not set" };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
          reply_to: message.replyTo,
        }),
        signal: AbortSignal.timeout(8000),
      });

      const payload = (await response.json()) as { id?: string; message?: string };

      if (!response.ok) {
        return { ok: false, error: payload.message ?? `HTTP ${response.status}` };
      }
      return { ok: true, id: payload.id };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not reach Resend",
      };
    }
  },
};
