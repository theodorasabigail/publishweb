/**
 * The emails the shop sends.
 *
 * Deliberately plain HTML: tables, inline styles, no images, no web fonts.
 * Every mail client renders this identically, and none of it can break the
 * layout of an inbox on a phone. The plain-text half is written to be read on
 * its own, not as a stripped copy of the HTML.
 *
 * Each template returns a full EmailMessage so the calling code never composes
 * a subject line or worries about escaping.
 */

import { siteUrl } from "@/lib/env";
import { formatIDR } from "@/lib/utils";
import type { EmailMessage } from "./types";
import type { Order, OrderItem, SiteSettings } from "@/lib/types";

const BRAND = "Publish Coffee Roasters";

/** HTML-escape. Product names and customer names are operator- and
 *  customer-supplied, so they are never trusted into markup. */
function esc(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The shell every email sits in.
 *
 * One centred column, a wordmark, the body, and a footer carrying whatever
 * contact details the operator has filled in. Nothing here needs changing to
 * add a new email.
 */
function shell(options: {
  heading: string;
  intro: string;
  body: string;
  settings?: SiteSettings | null;
}): string {
  const contacts: string[] = [];
  if (options.settings?.contact_email) {
    contacts.push(
      `<a href="mailto:${esc(options.settings.contact_email)}" style="color:#6b5b4d;">${esc(options.settings.contact_email)}</a>`,
    );
  }
  if (options.settings?.whatsapp_number) {
    contacts.push(`WhatsApp ${esc(options.settings.whatsapp_number)}`);
  }

  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f6f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1b1613;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ef;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px;">
          <tr>
            <td>
              <p style="margin:0 0 24px;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#6b5b4d;">${BRAND}</p>
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:600;">${esc(options.heading)}</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a4038;">${esc(options.intro)}</p>
              ${options.body}
            </td>
          </tr>
        </table>
        <p style="max-width:560px;margin:20px auto 0;font-size:12px;line-height:1.6;color:#8a7d70;text-align:center;">
          ${BRAND}${contacts.length ? ` &middot; ${contacts.join(" &middot; ")}` : ""}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function orderUrl(order: Order): string {
  return `${siteUrl()}/order/${order.id}`;
}

function itemsTableHtml(items: OrderItem[]): string {
  const rows = items
    .map(
      (item) => `
          <tr>
            <td style="padding:8px 0;font-size:14px;line-height:1.5;border-bottom:1px solid #efeae4;">
              ${esc(item.name_snapshot)}<br>
              <span style="color:#8a7d70;font-size:13px;">${esc(item.size_snapshot)} &times; ${item.quantity}</span>
            </td>
            <td align="right" style="padding:8px 0;font-size:14px;white-space:nowrap;border-bottom:1px solid #efeae4;">
              ${formatIDR(item.unit_price_idr * item.quantity)}
            </td>
          </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

function totalsHtml(order: Order): string {
  const line = (label: string, value: string, strong = false) => `
          <tr>
            <td style="padding:4px 0;font-size:${strong ? "15px" : "14px"};color:${strong ? "#1b1613" : "#4a4038"};${strong ? "font-weight:600;" : ""}">${esc(label)}</td>
            <td align="right" style="padding:4px 0;font-size:${strong ? "15px" : "14px"};white-space:nowrap;${strong ? "font-weight:600;" : ""}">${value}</td>
          </tr>`;

  // A subsidy is shown as its own line rather than folded into the shipping
  // figure, because "we paid part of your postage" only lands if it is visible.
  const discount =
    order.shipping_discount_idr > 0
      ? line("Shipping discount", `&minus;${formatIDR(order.shipping_discount_idr)}`)
      : "";

  const shipping =
    order.channel === "online"
      ? line("Shipping", order.shipping_idr > 0 ? formatIDR(order.shipping_idr) : "Free")
      : "";

  // The unique code is how a bank transfer gets matched to this order, so it
  // is spelled out rather than silently included in the total.
  const uniqueCode =
    order.unique_code > 0 ? line("Unique code", formatIDR(order.unique_code)) : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
          ${line("Subtotal", formatIDR(order.subtotal_idr))}
          ${shipping}
          ${discount}
          ${uniqueCode}
          ${line("Total", formatIDR(order.total_idr), true)}
        </table>`;
}

function buttonHtml(href: string, label: string): string {
  return `<p style="margin:28px 0 0;">
          <a href="${esc(href)}" style="display:inline-block;background:#1b1613;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:8px;">${esc(label)}</a>
        </p>`;
}

function itemsTextLines(items: OrderItem[]): string {
  return items
    .map(
      (item) =>
        `  ${item.name_snapshot} (${item.size_snapshot}) x${item.quantity}  ${formatIDR(item.unit_price_idr * item.quantity)}`,
    )
    .join("\n");
}

// ---------------------------------------------------------------------------
// Order confirmation — sent once, when payment is confirmed
// ---------------------------------------------------------------------------

export function orderConfirmationEmail(input: {
  to: string;
  order: Order;
  items: OrderItem[];
  settings?: SiteSettings | null;
}): EmailMessage {
  const { order, items, settings } = input;
  const name = order.shipping_address?.recipient_name?.split(" ")[0] ?? null;
  const greeting = name ? `Thank you, ${name}.` : "Thank you.";

  const points =
    order.points_awarded > 0
      ? `<p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#4a4038;">You earned <strong>${order.points_awarded} loyalty ${order.points_awarded === 1 ? "point" : "points"}</strong> on this order.</p>`
      : "";

  const html = shell({
    heading: `${greeting} Your order is confirmed.`,
    intro: `We have your payment for order ${order.human_ref}. We roast to order, so your coffee is roasted in the next batch and posted straight after — we will email you the tracking number as soon as it is on its way.`,
    settings,
    body: `${itemsTableHtml(items)}${totalsHtml(order)}${points}${buttonHtml(orderUrl(order), "View your order")}`,
  });

  const text = [
    `${greeting} Your order is confirmed.`,
    ``,
    `Order ${order.human_ref}`,
    ``,
    itemsTextLines(items),
    ``,
    `Subtotal  ${formatIDR(order.subtotal_idr)}`,
    order.channel === "online"
      ? `Shipping  ${order.shipping_idr > 0 ? formatIDR(order.shipping_idr) : "Free"}`
      : null,
    order.shipping_discount_idr > 0
      ? `Shipping discount  -${formatIDR(order.shipping_discount_idr)}`
      : null,
    `Total     ${formatIDR(order.total_idr)}`,
    ``,
    // Trailing newline rather than a separate blank entry, so the blank line
    // disappears with the sentence when there are no points.
    order.points_awarded > 0
      ? `You earned ${order.points_awarded} loyalty point${order.points_awarded === 1 ? "" : "s"} on this order.\n`
      : null,
    `We roast to order, so your coffee is roasted in the next batch and posted`,
    `straight after. We will email the tracking number as soon as it ships.`,
    ``,
    orderUrl(order),
    ``,
    BRAND,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    to: input.to,
    subject: `Order ${order.human_ref} confirmed — ${BRAND}`,
    text,
    html,
    replyTo: settings?.contact_email ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Shipped — sent when a tracking number is attached
// ---------------------------------------------------------------------------

export function orderShippedEmail(input: {
  to: string;
  order: Order;
  trackingNumber: string;
  courier?: string | null;
  settings?: SiteSettings | null;
}): EmailMessage {
  const { order, trackingNumber, courier, settings } = input;
  const name = order.shipping_address?.recipient_name?.split(" ")[0] ?? null;
  const via = courier ? ` with ${courier}` : "";

  const html = shell({
    heading: name ? `${name}, your coffee is on its way.` : "Your coffee is on its way.",
    intro: `Order ${order.human_ref} left the roastery${via}. Use the tracking number below to follow it.`,
    settings,
    body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ef;border-radius:8px;">
          <tr>
            <td style="padding:16px 18px;">
              <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#8a7d70;">Tracking number</p>
              <p style="margin:0;font-size:18px;font-weight:600;letter-spacing:0.02em;">${esc(trackingNumber)}</p>
              ${courier ? `<p style="margin:6px 0 0;font-size:13px;color:#6b5b4d;">${esc(courier)}</p>` : ""}
            </td>
          </tr>
        </table>
        ${buttonHtml(orderUrl(order), "View your order")}`,
  });

  const text = [
    name ? `${name}, your coffee is on its way.` : "Your coffee is on its way.",
    ``,
    `Order ${order.human_ref} left the roastery${via}.`,
    ``,
    `Tracking number: ${trackingNumber}`,
    courier ? `Courier: ${courier}` : null,
    ``,
    orderUrl(order),
    ``,
    BRAND,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    to: input.to,
    subject: `Order ${order.human_ref} has shipped — ${BRAND}`,
    text,
    html,
    replyTo: settings?.contact_email ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Test send — proves the configuration works without inventing a fake order
// ---------------------------------------------------------------------------

export function testEmail(to: string): EmailMessage {
  const html = shell({
    heading: "Email is working.",
    intro:
      "This is a test from your admin dashboard. If you are reading it, order confirmations and shipping notifications will reach your customers.",
    body: buttonHtml(siteUrl(), "Open the shop"),
  });

  return {
    to,
    subject: `Test email — ${BRAND}`,
    text: `Email is working.\n\nThis is a test from your admin dashboard. If you are reading it, order confirmations and shipping notifications will reach your customers.\n\n${siteUrl()}\n\n${BRAND}`,
    html,
  };
}
