import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { OrderStatusBadge } from "@/components/status-badge";
import { PaymentPoller } from "@/components/shop/payment-poller";
import { isSupabaseConfigured } from "@/lib/env";
import { manualTransferDetails } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderWithItems } from "@/lib/types";
import { formatDateTime, formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isSupabaseConfigured()) notFound();

  // The order id is a uuid, and it is the capability: it is what we put in the
  // customer's confirmation link, so guests can follow their order without an
  // account. Nothing sensitive beyond their own order details is exposed.
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("orders")
    .select("*, order_items (*)")
    .eq("id", id)
    // Voided means it was entered in error. The customer gets a 404 rather
    // than a page for an order that, as far as the shop is concerned, never
    // happened.
    .is("voided_at", null)
    .maybeSingle();

  const order = data as OrderWithItems | null;
  if (!order) notFound();

  const isPending = order.status === "pending";
  const isCancelled = order.status === "cancelled";
  const manual = manualTransferDetails();
  const showManualInstructions =
    isPending && order.payment_method === "bank_transfer" && order.unique_code > 0;

  return (
    <div className="container-page max-w-3xl py-14">
      {isPending && <PaymentPoller />}

      <div className="flex items-start gap-4">
        {isPending ? (
          <Clock className="mt-1 h-8 w-8 shrink-0 text-amber-600" />
        ) : isCancelled ? (
          <XCircle className="mt-1 h-8 w-8 shrink-0 text-red-600" />
        ) : (
          <CheckCircle2 className="mt-1 h-8 w-8 shrink-0 text-emerald-600" />
        )}

        <div>
          <h1 className="text-3xl sm:text-4xl">
            {isPending
              ? "Almost there"
              : isCancelled
                ? "Order cancelled"
                : "Thank you — we've got your order"}
          </h1>
          <p className="mt-2 text-sea-800">
            Order <span className="font-medium text-sea-900">{order.human_ref}</span> ·{" "}
            {formatDateTime(order.created_at)}
          </p>
          <div className="mt-3">
            <OrderStatusBadge status={order.status} />
          </div>
        </div>
      </div>

      {isPending && order.payment_url && (
        <div className="card mt-8 p-6">
          <h2 className="text-xl">Complete your payment</h2>
          <p className="mt-2 text-sm text-sea-800">
            Your payment page is still open. This page updates automatically once
            the payment clears.
          </p>
          <a
            href={order.payment_url}
            className="btn-primary mt-5"
            target="_blank"
            rel="noreferrer noopener"
          >
            Pay {formatIDR(order.total_idr)}
          </a>
          {order.payment_expires_at && (
            <p className="mt-3 text-xs text-sea-800">
              Expires {formatDateTime(order.payment_expires_at)}
            </p>
          )}
        </div>
      )}

      {showManualInstructions && (
        <div className="card mt-8 p-6">
          <h2 className="text-xl">Transfer instructions</h2>
          <p className="mt-2 text-sm text-sea-800">
            Transfer this <strong>exact</strong> amount. The last three digits are
            your order&apos;s code — they are how we recognise your payment
            automatically.
          </p>

          <p className="mt-5 font-serif text-4xl">{formatIDR(order.total_idr)}</p>
          <p className="mt-1 text-sm text-sea-800">
            {formatIDR(order.total_idr - order.unique_code)} + kode unik{" "}
            {String(order.unique_code).padStart(3, "0")}
          </p>

          {(manual.bankName || manual.accountNumber) && (
            <dl className="mt-6 space-y-2 rounded-xl bg-sea-50 p-4 text-sm">
              {manual.bankName && (
                <div className="flex justify-between gap-4">
                  <dt className="text-sea-800">Bank</dt>
                  <dd className="font-medium">{manual.bankName}</dd>
                </div>
              )}
              {manual.accountNumber && (
                <div className="flex justify-between gap-4">
                  <dt className="text-sea-800">Account number</dt>
                  <dd className="font-mono font-medium">{manual.accountNumber}</dd>
                </div>
              )}
              {manual.accountName && (
                <div className="flex justify-between gap-4">
                  <dt className="text-sea-800">Account name</dt>
                  <dd className="font-medium">{manual.accountName}</dd>
                </div>
              )}
            </dl>
          )}

          {manual.qrisImageUrl && (
            <div className="mt-6">
              <p className="label">Or scan QRIS</p>
              {/* Operator-supplied static QR; rendered as a plain img so the
                  URL does not need to be a configured image host. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={manual.qrisImageUrl}
                alt="QRIS payment code"
                className="mt-2 w-56 rounded-xl border border-sea-200"
              />
              <p className="mt-2 text-xs text-sea-800">
                Type the exact amount above, including the last three digits.
              </p>
            </div>
          )}

          <p className="mt-5 text-xs text-sea-800">
            Payment is confirmed automatically, usually within a few minutes of
            the transfer landing. This page refreshes itself.
          </p>
        </div>
      )}

      <div className="card mt-8 overflow-hidden">
        <div className="border-b border-sea-200/70 px-6 py-4">
          <h2 className="text-xl">Order summary</h2>
        </div>

        <ul className="divide-y divide-sea-200/70">
          {order.order_items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 px-6 py-4">
              <div>
                <p className="font-medium">{item.name_snapshot}</p>
                <p className="text-sm text-sea-800">
                  {item.size_snapshot} × {item.quantity}
                </p>
              </div>
              <p className="shrink-0 font-medium">
                {formatIDR(item.unit_price_idr * item.quantity)}
              </p>
            </li>
          ))}
        </ul>

        <dl className="space-y-2 border-t border-sea-200/70 px-6 py-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-sea-800">Subtotal</dt>
            <dd>{formatIDR(order.subtotal_idr)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sea-800">Shipping</dt>
            <dd>{order.shipping_idr === 0 ? "Free" : formatIDR(order.shipping_idr)}</dd>
          </div>
          {order.unique_code > 0 && (
            <div className="flex justify-between">
              <dt className="text-sea-800">Kode unik</dt>
              <dd>{order.unique_code}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-sea-200/70 pt-2 text-base font-medium">
            <dt>Total</dt>
            <dd>{formatIDR(order.total_idr)}</dd>
          </div>
          {order.points_awarded > 0 && (
            <p className="pt-1 text-xs text-emerald-700">
              {order.points_awarded} loyalty points earned on this order.
            </p>
          )}
        </dl>
      </div>

      {order.shipping_address && (
        <div className="card mt-6 p-6">
          <h2 className="text-lg">Shipping to</h2>
          <address className="mt-3 text-sm not-italic leading-relaxed text-sea-700">
            {order.shipping_address.recipient_name}
            <br />
            {order.shipping_address.line1}
            {order.shipping_address.line2 && (
              <>
                <br />
                {order.shipping_address.line2}
              </>
            )}
            <br />
            {order.shipping_address.city}
            {order.shipping_address.province && `, ${order.shipping_address.province}`}{" "}
            {order.shipping_address.postal_code}
            <br />
            {order.shipping_address.country}
            <br />
            {order.shipping_address.phone}
          </address>

          {order.shipped_at && (
            <p className="mt-4 text-sm">
              <span className="text-sea-800">Sent:</span>{" "}
              {formatDateTime(order.shipped_at)}
            </p>
          )}

          {order.tracking_number && (
            <p className="mt-1 text-sm">
              <span className="text-sea-800">Tracking:</span>{" "}
              <span className="font-mono">{order.tracking_number}</span>
            </p>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/shop" className="btn-secondary">
          Keep shopping
        </Link>
        {!order.user_id && (
          <Link href="/signup" className="btn-ghost">
            Create an account to track this order
          </Link>
        )}
        {order.user_id && (
          <Link href="/account/orders" className="btn-ghost">
            All your orders
          </Link>
        )}
      </div>
    </div>
  );
}
