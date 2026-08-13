import { env } from "@/lib/env";
import { resendProvider } from "./resend";
import type { EmailMessage, EmailProvider, EmailResult } from "./types";

export * from "./types";
export * from "./templates";

/** Used when no email service is configured. Records the attempt and moves on
 *  — a missing receipt must never fail an order that has been paid for. */
const noopProvider: EmailProvider = {
  id: "none",
  label: "No email configured",
  async send(message: EmailMessage): Promise<EmailResult> {
    console.info(`[email skipped — nothing configured] to=${message.to} subject=${message.subject}`);
    return { ok: false, error: "no email provider configured" };
  },
};

export function getEmailProvider(): EmailProvider {
  const id = (env.optional("EMAIL_PROVIDER") ?? "").toLowerCase();
  if (id === "resend" || (!id && env.optional("RESEND_API_KEY"))) return resendProvider;
  return noopProvider;
}

export function isEmailConfigured(): boolean {
  return getEmailProvider().id !== "none";
}

/**
 * Send, and never throw.
 *
 * Every caller is on a path that has already succeeded — an order is paid, a
 * parcel has shipped. An email failing after that point must be logged and
 * forgotten, never allowed to roll back or error out of something real.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  try {
    const result = await getEmailProvider().send(message);
    if (!result.ok && result.error !== "no email provider configured") {
      console.error(`email failed: ${result.error} (to=${message.to})`);
    }
    return result;
  } catch (error) {
    console.error("email threw unexpectedly", error);
    return { ok: false, error: "unexpected failure" };
  }
}
