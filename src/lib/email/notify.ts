/**
 * Deciding whether to send an email, and to whom.
 *
 * Kept apart from the templates and the provider because the hard parts here
 * are neither: working out the customer's address when an order might be from
 * a guest, and making sure a retried webhook does not send a second receipt.
 *
 * Every function returns rather than throws. Each one is called from a path
 * that has already succeeded — the money has arrived, the parcel has gone —
 * and email must never be able to undo that.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { getSiteSettings } from "@/lib/queries";
import type { Order, OrderItem } from "@/lib/types";
import { sendEmail, isEmailConfigured } from "./index";
import { orderConfirmationEmail, orderShippedEmail } from "./templates";

type Supabase = ReturnType<typeof createAdminClient>;

/**
 * Where to send an order's email.
 *
 * A signed-in customer's address lives on their profile, a guest's on the
 * order, and the checkout form collects one into the address snapshot as well.
 * Any of the three can be the only one present.
 */
async function recipientFor(supabase: Supabase, order: Order): Promise<string | null> {
  const direct = order.guest_email ?? order.shipping_address?.email ?? null;
  if (direct) return direct;

  if (!order.user_id) return null;
  const { data } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", order.user_id)
    .maybeSingle();
  return (data as { email: string | null } | null)?.email ?? null;
}

async function loadOrder(
  supabase: Supabase,
  orderId: string,
): Promise<{ order: Order; items: OrderItem[] } | null> {
  const { data } = await supabase
    .from("orders")
    .select("*, order_items (*)")
    .eq("id", orderId)
    .maybeSingle();

  if (!data) return null;
  const { order_items, ...order } = data as Order & { order_items: OrderItem[] };
  return { order, items: order_items ?? [] };
}

/**
 * Receipt for a newly paid order.
 *
 * The send is *claimed* first: an update that only matches while
 * confirmation_email_sent_at is still null. Two webhook deliveries racing each
 * other means exactly one update matches a row, so exactly one email goes out.
 * Claiming before sending rather than marking after also means a crash
 * mid-send costs a missing receipt instead of a duplicated one — the better
 * failure of the two.
 */
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  if (!isSupabaseConfigured() || !isEmailConfigured()) return;

  try {
    const supabase = createAdminClient();

    // Every reason not to send is settled BEFORE the send is claimed.
    //
    // The claim exists to stop a redelivered webhook sending twice, so it has
    // to be written before the email goes out. But it was being written before
    // the decision too, and a bail-out afterwards left the order marked as
    // notified with nothing sent -- and unable to be notified later, because
    // the mark is what suppresses the second attempt. Deciding first costs one
    // extra read and cannot strand an order.
    const loaded = await loadOrder(supabase, orderId);
    if (!loaded) return;

    // A counter sale is handed over across the counter. There is nobody
    // waiting on an email and usually no address to send one to. Every other
    // channel gets a receipt -- an order agreed over WhatsApp is still an
    // order somebody is waiting for.
    if (loaded.order.channel === "pos") return;

    const to = await recipientFor(supabase, loaded.order);
    if (!to) {
      console.info(`no email address for order ${loaded.order.human_ref}; receipt skipped`);
      return;
    }

    const { data: claimed } = await supabase
      .from("orders")
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq("id", orderId)
      .is("confirmation_email_sent_at", null)
      .select("id")
      .maybeSingle();

    if (!claimed) return;

    const settings = await getSiteSettings(supabase);
    const result = await sendEmail(
      orderConfirmationEmail({ to, order: loaded.order, items: loaded.items, settings }),
    );

    // Releasing the claim on failure lets a retried webhook, or the admin
    // marking the order paid again, have another go.
    if (!result.ok) {
      await supabase
        .from("orders")
        .update({ confirmation_email_sent_at: null })
        .eq("id", orderId);
    }
  } catch (error) {
    console.error("order confirmation email failed", { orderId, error });
  }
}

/**
 * Tracking number notification.
 *
 * Guarded on the tracking number itself rather than a timestamp: saving the
 * fulfilment form twice sends nothing, but fixing a mistyped number sends the
 * corrected one, because the customer is otherwise holding a number that does
 * not work.
 */
export async function sendOrderShipped(orderId: string): Promise<void> {
  if (!isSupabaseConfigured() || !isEmailConfigured()) return;

  try {
    const supabase = createAdminClient();
    const loaded = await loadOrder(supabase, orderId);
    if (!loaded) return;

    const { order } = loaded;
    const tracking = order.tracking_number?.trim();
    if (!tracking) return;
    if (order.shipped_email_tracking === tracking) return;
    // Any order with a tracking number has something in the post, whichever
    // conversation it started in. A counter sale never gets one, so it never
    // reaches here and needs no special case.

    const to = await recipientFor(supabase, order);
    if (!to) return;

    const settings = await getSiteSettings(supabase);
    const result = await sendEmail(
      orderShippedEmail({
        to,
        order,
        trackingNumber: tracking,
        // Only a real courier name from the courier itself. courier_note is
        // free text the operator writes for their own reference and would read
        // oddly dropped into a sentence.
        courier: order.courier_company,
        settings,
      }),
    );

    if (result.ok) {
      await supabase
        .from("orders")
        .update({ shipped_email_tracking: tracking })
        .eq("id", orderId);
    }
  } catch (error) {
    console.error("shipped email failed", { orderId, error });
  }
}
