import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Field, PageHeader, Panel } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/status-badge";
import { updateOrderFulfilment, updateOrderStatus } from "@/app/admin/_actions/orders";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORDER_STATUSES, type OrderWithItems, type Profile } from "@/lib/types";
import { formatDateTime, formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("orders")
    .select("*, order_items (*)")
    .eq("id", id)
    .maybeSingle();

  const order = data as OrderWithItems | null;
  if (!order) notFound();

  let customer: Profile | null = null;
  if (order.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", order.user_id)
      .maybeSingle();
    customer = (profile as Profile | null) ?? null;
  }

  const address = order.shipping_address;

  return (
    <div>
      <Link
        href="/admin/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark-600 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All orders
      </Link>

      <PageHeader
        title={order.human_ref}
        description={
          order.channel === "pos"
            ? `Sold at the counter, ${formatDateTime(order.created_at)}`
            : `Placed online, ${formatDateTime(order.created_at)}`
        }
        action={<OrderStatusBadge status={order.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Panel title="Items">
            <ul className="divide-y divide-bark-200">
              {order.order_items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium">{item.name_snapshot}</p>
                    <p className="text-sm text-bark-500">
                      {item.size_snapshot} × {item.quantity}
                    </p>
                  </div>
                  <p className="font-medium">
                    {formatIDR(item.unit_price_idr * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-bark-200 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-bark-600">Subtotal</dt>
                <dd>{formatIDR(order.subtotal_idr)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-bark-600">
                  Shipping{order.shipping_zone ? ` (${order.shipping_zone})` : ""}
                </dt>
                <dd>{formatIDR(order.shipping_idr)}</dd>
              </div>
              {order.unique_code > 0 && (
                <div className="flex justify-between">
                  <dt className="text-bark-600">Kode unik</dt>
                  <dd>{order.unique_code}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-bark-200 pt-2 font-medium">
                <dt>Total</dt>
                <dd>{formatIDR(order.total_idr)}</dd>
              </div>
            </dl>
          </Panel>

          {order.customer_note && (
            <Panel title="Note from the customer">
              <p className="text-sm text-bark-700">{order.customer_note}</p>
            </Panel>
          )}

          <Panel title={order.channel === "pos" ? "Counter sale" : "Shipping"}>
            {order.channel === "pos" ? (
              <p className="text-sm text-bark-600">
                Sold in the shop — nothing to pack or ship. The customer took it
                with them.
              </p>
            ) : address ? (
              <address className="text-sm not-italic leading-relaxed text-bark-700">
                <strong className="text-ink">{address.recipient_name}</strong>
                <br />
                {address.line1}
                {address.line2 && (
                  <>
                    <br />
                    {address.line2}
                  </>
                )}
                <br />
                {address.city}
                {address.province && `, ${address.province}`} {address.postal_code}
                <br />
                {address.country}
                <br />
                {address.phone}
                {address.email && (
                  <>
                    <br />
                    {address.email}
                  </>
                )}
              </address>
            ) : (
              <p className="text-sm text-bark-500">No address recorded.</p>
            )}

            {order.channel === "online" && (
            <form action={updateOrderFulfilment} className="mt-5 space-y-4 border-t border-bark-200 pt-5">
              <input type="hidden" name="id" value={order.id} />
              <Field
                label="Tracking number"
                hint="The customer sees this on their order page."
              >
                <input
                  name="tracking_number"
                  className="input"
                  defaultValue={order.tracking_number ?? ""}
                />
              </Field>
              <Field label="Internal note">
                <input
                  name="courier_note"
                  className="input"
                  defaultValue={order.courier_note ?? ""}
                  placeholder="Courier, pickup time, anything worth remembering"
                />
              </Field>
              <button type="submit" className="btn-secondary py-2 text-xs">
                Save shipping details
              </button>
            </form>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Move this order along">
            <form action={updateOrderStatus} className="space-y-3">
              <input type="hidden" name="id" value={order.id} />
              <select name="status" className="input" defaultValue={order.status}>
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status} className="capitalize">
                    {status}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-primary w-full">
                Update status
              </button>
            </form>

            {!order.paid_at && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                Setting this to <strong>paid</strong> does everything a real
                payment does: it takes the stock down and awards loyalty points.
                Only use it when you have confirmed the money arrived.
              </p>
            )}
          </Panel>

          <Panel title="Payment">
            <dl className="space-y-2 text-sm">
              <Row label="Method" value={order.payment_method ?? "—"} />
              <Row label="Reference" value={order.payment_ref ?? "—"} />
              <Row
                label="Paid at"
                value={order.paid_at ? formatDateTime(order.paid_at) : "Not yet"}
              />
              <Row label="Points awarded" value={String(order.points_awarded)} />
              {order.cash_received_idr !== null && (
                <>
                  <Row label="Cash received" value={formatIDR(order.cash_received_idr)} />
                  <Row
                    label="Change given"
                    value={formatIDR(order.cash_received_idr - order.total_idr)}
                  />
                </>
              )}
            </dl>

            {order.payment_url && !order.paid_at && (
              <a
                href={order.payment_url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-4 block text-xs underline"
              >
                Open the customer&apos;s payment page
              </a>
            )}
          </Panel>

          <Panel title="Customer">
            {customer ? (
              <div className="space-y-2 text-sm">
                <Row label="Name" value={customer.display_name ?? "—"} />
                <Row label="Email" value={customer.email ?? "—"} />
                <Row label="Tier" value={customer.tier} />
                <Row label="Points" value={String(customer.loyalty_points)} />
                <Link
                  href={`/admin/customers/${customer.id}`}
                  className="mt-2 block text-xs underline"
                >
                  Open customer record
                </Link>
              </div>
            ) : (
              <p className="text-sm text-bark-600">
                {order.channel === "pos"
                  ? "Walk-in customer. Attach an account at the till next time to award points."
                  : `Guest checkout${order.guest_email ? ` — ${order.guest_email}` : ""}. No points awarded on guest orders.`}
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-bark-600">{label}</dt>
      <dd className="truncate text-right font-medium">{value}</dd>
    </div>
  );
}
