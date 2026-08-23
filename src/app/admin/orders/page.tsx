import Link from "next/link";
import { EmptyRow, PageHeader } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/status-badge";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CHANNEL_LABELS,
  ORDER_STATUSES,
  type Order,
  type OrderStatus,
  type SalesChannel,
} from "@/lib/types";
import { cn, formatDateTime, formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  ...ORDER_STATUSES.map((status) => ({ value: status, label: status })),
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; channel?: string; show?: string }>;
}) {
  const { status, channel, show } = await searchParams;
  // Voided orders are mistakes, so they are out of the way rather than gone:
  // findable on purpose, never in the way by accident.
  const showVoided = show === "voided";
  const active = status && ORDER_STATUSES.includes(status as OrderStatus) ? status : "all";
  const activeChannel =
    channel && channel in CHANNEL_LABELS ? (channel as SalesChannel) : "all";

  const supabase = createAdminClient();
  let query = supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (active !== "all") query = query.eq("status", active);
  if (activeChannel !== "all") query = query.eq("channel", activeChannel);
  if (showVoided) query = query.not("voided_at", "is", null);
  else query = query.is("voided_at", null);

  const { data } = await query;
  const orders = (data ?? []) as Order[];

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Every order in one place, wherever it came from — the website, the counter, or a message. Move each one along as you roast, pack and ship it."
      />

      <nav className="mb-3 flex flex-wrap gap-2" aria-label="Sales channel">
        {[
          { value: "all", label: "Everywhere" },
          ...Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label })),
        ].map((option) => (
          <Link
            key={option.value}
            href={
              option.value === "all"
                ? "/admin/orders"
                : `/admin/orders?channel=${option.value}`
            }
            className={cn(
              "badge",
              activeChannel === option.value
                ? "bg-sea-700 text-cream"
                : "border border-sea-200 bg-white text-sea-700 hover:border-sea-400",
            )}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      <nav className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value === "all" ? "/admin/orders" : `/admin/orders?status=${filter.value}`}
            className={cn(
              "badge capitalize",
              !showVoided && active === filter.value
                ? "bg-sea-800 text-cream"
                : "border border-sea-200 bg-white text-sea-700 hover:border-sea-400",
            )}
          >
            {filter.label}
          </Link>
        ))}
        <Link
          href="/admin/orders?show=voided"
          className={cn(
            "badge",
            showVoided
              ? "bg-amber-600 text-white"
              : "border border-sea-200 bg-white text-sea-700 hover:border-sea-400",
          )}
        >
          Voided
        </Link>
      </nav>

      {showVoided && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          These were entered by mistake and undone. Their stock and points have
          been put back, and they count towards nothing.
        </p>
      )}

      {orders.length ? (
        <div className="overflow-x-auto rounded-xl border border-sea-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-sea-200 text-left text-xs uppercase tracking-wider text-sea-800">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Placed</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Where</th>
                <th className="px-4 py-3 font-medium">Ships to</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sea-200">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-sea-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium hover:underline"
                    >
                      {order.human_ref}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sea-800">
                    {formatDateTime(order.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sea-800">
                    {order.shipping_address?.recipient_name ??
                      order.channel_reference ??
                      (order.channel === "pos" ? "Walk-in" : "—")}
                    {!order.user_id && order.channel === "online" && (
                      <span className="ml-1.5 text-xs text-sea-800">(guest)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "badge",
                        order.channel === "online"
                          ? "bg-sky-100 text-sky-800"
                          : order.channel === "pos"
                            ? "bg-sea-100 text-sea-800"
                            : "bg-amber-100 text-amber-900",
                      )}
                    >
                      {CHANNEL_LABELS[order.channel] ?? order.channel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sea-800">
                    {order.shipping_address?.city ?? "—"}
                    {order.shipping_address?.country
                      ? `, ${order.shipping_address.country}`
                      : ""}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                    {order.stock_reserved_at && (
                      <span
                        className="ml-1.5 text-xs text-amber-700"
                        title="This order is holding stock that is not on sale on the website."
                      >
                        holding stock
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatIDR(order.total_idr)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyRow>
          {showVoided ? "Nothing has been voided." : "No orders with that status."}
        </EmptyRow>
      )}
    </div>
  );
}
