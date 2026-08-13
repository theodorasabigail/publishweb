/**
 * Transactional email provider contract.
 *
 * Same shape as the payment and shipping adapters: one interface, a provider
 * chosen by environment variable, and a no-op default so the shop works
 * perfectly well with no email configured at all.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain text. Always sent — some people, and some spam filters, prefer it. */
  text: string;
  html: string;
  replyTo?: string;
}

export interface EmailResult {
  ok: boolean;
  /** Provider-side id, useful when chasing a missing email. */
  id?: string;
  error?: string;
}

export interface EmailProvider {
  readonly id: string;
  readonly label: string;
  send(message: EmailMessage): Promise<EmailResult>;
}
