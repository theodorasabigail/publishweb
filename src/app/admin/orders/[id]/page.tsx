import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Field, PageHeader, Panel } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/status-badge";
import {
  updateOrderDetails,
  updateOrderFulfilment,
  updateOrderStatus,
} from "@/app/admin/_actions/orders";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CHANNEL_LABELS,
  CHANNEL_REFERENCE_LABELS,
  ORDER_STATUSES,
  type OrderWithItems,
  type Profile,
  type SalesChannel,
} from "@/lib/types";
import { formatDateTime, formatIDR, toShopDateTimeInput } from "@/lib/utils";

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
  // What separates "there is something to pack" from "the customer has it" is
  // whether an address was recorded, not which channel the order came from.
  // A WhatsApp order can be either.
  const ships = Boolean(address);
  const isManual = order.channel !== "online";

  return (
    <div>
      <Link
        href="/admin/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-sea-800 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All orders
      </Link>

      <PageHeader
        title={order.human_ref}
        description={
          order.channel === "online"
            ? `Placed online, ${formatDateTime(order.created_at)}`
            : order.channel === "pos"
              ? `Sold at the counter, ${formatDateTime(order.created_at)}`
              : `Taken by hand via ${CHANNEL_LABELS[order.channel]}, ${formatDateTime(order.created_at)}`
        }
        action={<OrderStatusBadge status={order.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Panel title="Items">
            <ul className="divide-y divide-sea-200">
              {order.order_items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium">{item.name_snapshot}</p>
                    <p className="text-sm text-sea-800">
                      {item.size_snapshot} × {item.quantity}
                    </p>
                  </div>
                  <p className="font-medium">
                    {formatIDR(item.unit_price_idr * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-sea-200 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-sea-800">Subtotal</dt>
                <dd>{formatIDR(order.subtotal_idr)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sea-800">
                  Shipping{order.shipping_zone ? ` (${order.shipping_zone})` : ""}
                </dt>
                <dd>{formatIDR(order.shipping_idr)}</dd>
              </div>
              {order.shipping_discount_idr > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <dt>Shipping you covered</dt>
                  <dd>{formatIDR(order.shipping_discount_idr)}</dd>
                </div>
              )}
              {order.unique_code > 0 && (
                <div className="flex justify-between">
                  <dt className="text-sea-800">Kode unik</dt>
                  <dd>{order.unique_code}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-sea-200 pt-2 font-medium">
                <dt>Total</dt>
                <dd>{formatIDR(order.total_idr)}</dd>
              </div>
            </dl>
          </Panel>

          {order.customer_note && (
            <Panel title="Note from the customer">
              <p className="text-sm text-sea-700">{order.customer_note}</p>
            </Panel>
          )}

          <Panel title={ships ? "Shipping" : "Collected"}>
            {!ships ? (
              <p className="text-sm text-sea-800">
                {order.channel === "pos"
                  ? "Sold in the shop — nothing to pack or ship. The customer took it with them."
                  : "No address on this one, so the customer is collecting it. Nothing to pack."}
              </p>
            ) : address ? (
              <address className="text-sm not-italic leading-relaxed text-sea-700">
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
              <p className="text-sm text-sea-800">No address recorded.</p>
            )}

            {ships && (
            <form action={updateOrderFulfilment} className="mt-5 space-y-4 border-t border-sea-200 pt-5">
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

          <Panel
            title="Correct the details"
            description="For fixing what was written down, not for changing what happened. Nothing here moves stock, money or points."
          >
            <form action={updateOrderDetails} className="space-y-4">
              <input type="hidden" name="id" value={order.id} />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Came in through">
                  <select
                    name="channel"
                    className="input"
                    defaultValue={order.channel}
                  >
                    {(Object.keys(CHANNEL_LABELS) as SalesChannel[]).map((value) => (
                      <option key={value} value={value}>
                        {CHANNEL_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Reference"
                  hint="Their number, @handle or marketplace order id."
                >
                  <input
                    name="channel_reference"
                    className="input"
                    defaultValue={order.channel_reference ?? ""}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Paid at"
                  hint={
                    order.paid_at
                      ? "Jakarta time."
                      : "Not paid yet — use the status control, which also takes the stock down."
                  }
                >
                  <input
                    type="datetime-local"
                    name="paid_at"
                    className="input"
                    disabled={!order.paid_at}
                    defaultValue={toShopDateTimeInput(order.paid_at)}
                  />
                </Field>
                <Field
                  label="Shipped at"
                  hint="Jakarta time. Leave empty if it has not gone out."
                >
                  <input
                    type="datetime-local"
                    name="shipped_at"
                    className="input"
                    defaultValue={toShopDateTimeInput(order.shipped_at)}
                  />
                </Field>
              </div>

              <fieldset className="space-y-4 border-t border-sea-200 pt-4">
                <legend className="text-xs uppercase tracking-wider text-sea-800">
                  Where it is going
                </legend>
                <p className="text-xs text-sea-800">
                  Clearing the name empties the address entirely, which marks
                  the order as one the customer is collecting.
                </p>

                <Field label="Name">
                  <input
                    name="recipient_name"
                    className="input"
                    defaultValue={address?.recipient_name ?? ""}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Phone">
                    <input
                      name="phone"
                      className="input"
                      defaultValue={address?.phone ?? ""}
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      name="email"
                      className="input"
                      defaultValue={address?.email ?? ""}
                    />
                  </Field>
                </div>
                <Field label="Street address">
                  <input
                    name="line1"
                    className="input"
                    defaultValue={address?.line1 ?? ""}
                  />
                </Field>
                <Field label="Apartment, RT/RW">
                  <input
                    name="line2"
                    className="input"
                    defaultValue={address?.line2 ?? ""}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="City">
                    <input
                      name="city"
                      className="input"
                      defaultValue={address?.city ?? ""}
                    />
                  </Field>
                  <Field label="Province">
                    <input
                      name="province"
                      className="input"
                      defaultValue={address?.province ?? ""}
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Postcode">
                    <input
                      name="postal_code"
                      className="input"
                      defaultValue={address?.postal_code ?? ""}
                    />
                  </Field>
                  <Field label="Country">
                    <input
                      name="country"
                      className="input"
                      defaultValue={address?.country ?? "ID"}
                    />
                  </Field>
                </div>
              </fieldset>

              <button type="submit" className="btn-secondary py-2 text-xs">
                Save corrections
              </button>
            </form>
          </Panel>
        </div>

        <div className="space-y-6">
          {isManual && (
            <Panel title="Where this came from">
              <dl className="space-y-2 text-sm">
                <Row label="Channel" value={CHANNEL_LABELS[order.channel]} />
                {order.channel_reference && (
                  <Row
                    label={CHANNEL_REFERENCE_LABELS[order.channel] ?? "Reference"}
                    value={order.channel_reference}
                  />
                )}
              </dl>
            </Panel>
          )}

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

            {order.stock_reserved_at && (
              <p className="mt-3 rounded-lg bg-sea-50 p-3 text-xs text-sea-800">
                This order is <strong>holding its coffee</strong> since{" "}
                {formatDateTime(order.stock_reserved_at)} — the website will not
                sell it to anyone else. Marking it paid turns that hold into a
                real stock reduction; cancelling puts the coffee back on the
                shelf.
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
              <Row
                label="Shipped at"
                value={order.shipped_at ? formatDateTime(order.shipped_at) : "Not yet"}
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

          {order.courier_order_id && (
            <Panel title="Courier">
              <dl className="space-y-2 text-sm">
                <Row label="Company" value={order.courier_company ?? "—"} />
                <Row label="Service" value={order.courier_type ?? "—"} />
                <Row label="Waybill" value={order.courier_waybill_id ?? "—"} />
                <Row label="Courier status" value={order.courier_status ?? "—"} />
                {order.courier_driver_name && (
                  <Row label="Driver" value={order.courier_driver_name} />
                )}
                {order.courier_driver_phone && (
                  <Row label="Driver phone" value={order.courier_driver_phone} />
                )}
              </dl>

              {order.courier_charged_idr !== null &&
                order.courier_charged_idr > order.shipping_idr && (
                  <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                    The courier charged{" "}
                    <strong>{formatIDR(order.courier_charged_idr)}</strong> against
                    the {formatIDR(order.shipping_idr)} you quoted — a difference
                    of {formatIDR(order.courier_charged_idr - order.shipping_idr)},
                    usually because the parcel weighed more than expected. The
                    customer has not been charged for it. If this keeps happening
                    on the same coffee, its shipping weight is probably wrong.
                  </p>
                )}
            </Panel>
          )}

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
              <p className="text-sm text-sea-800">
                {order.channel === "pos"
                  ? "Walk-in customer. Attach an account at the till next time to award points."
                  : isManual
                    ? "No account attached, so no points were awarded. Attaching one when you write the order down is what earns them."
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
      <dt className="text-sea-800">{label}</dt>
      <dd className="truncate text-right font-medium">{value}</dd>
    </div>
  );
}
