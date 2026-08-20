import Link from "next/link";
import { EmptyRow, PageHeader } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/status-badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORDER_STATUSES, type Order, type OrderStatus } from "@/lib/types";
import { cn, formatDateTime, formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  ...ORDER_STATUSES.map((status) => ({ value: status, label: status })),
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; channel?: string }>;
}) {
  const { status, channel } = await searchParams;
  const active = status && ORDER_STATUSES.includes(status as OrderStatus) ? status : "all";

  const supabase = createAdminClient();
  let query = supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (active !== "all") query = query.eq("status", active);
  const activeChannel = channel === "pos" || channel === "online" ? channel : "all";
  if (activeChannel !== "all") query = query.eq("channel", activeChannel);

  const { data } = await query;
  const orders = (data ?? []) as Order[];

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Move an order along as you roast, pack and ship it."
      />

      <nav className="mb-3 flex flex-wrap gap-2" aria-label="Sales channel">
        {[
          { value: "all", label: "Everywhere" },
          { value: "online", label: "Website" },
          { value: "pos", label: "Shop counter" },
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
                ? "bg-bark-700 text-cream"
                : "border border-bark-200 bg-white text-bark-700 hover:border-bark-400",
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
              active === filter.value
                ? "bg-bark-800 text-cream"
                : "border border-bark-200 bg-white text-bark-700 hover:border-bark-400",
            )}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      {orders.length ? (
        <div className="overflow-x-auto rounded-xl border border-bark-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-bark-200 text-left text-xs uppercase tracking-wider text-bark-600">
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
            <tbody className="divide-y divide-bark-200">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-bark-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium hover:underline"
                    >
                      {order.human_ref}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-bark-600">
                    {formatDateTime(order.created_at)}
                  </td>
                  <td className="px-4 py-3 text-bark-600">
                    {order.shipping_address?.recipient_name ??
                      (order.channel === "pos" ? "Walk-in" : "—")}
                    {!order.user_id && order.channel === "online" && (
                      <span className="ml-1.5 text-xs text-bark-600">(guest)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        order.channel === "pos"
                          ? "badge bg-bark-100 text-bark-800"
                          : "badge bg-sky-100 text-sky-800"
                      }
                    >
                      {order.channel === "pos" ? "Shop" : "Website"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-bark-600">
                    {order.channel === "pos"
                      ? "—"
                      : order.shipping_address?.city ?? "—"}
                    {order.channel === "online" && order.shipping_address?.country
                      ? `, ${order.shipping_address.country}`
                      : ""}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
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
        <EmptyRow>No orders with that status.</EmptyRow>
      )}
    </div>
  );
}
