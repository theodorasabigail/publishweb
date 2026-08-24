import Link from "next/link";
import { EmptyRow, PageHeader } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/status-badge";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CHANNEL_LABELS,
  ORDER_STATUSES,
  addressIsComplete,
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
  searchParams: Promise<{
    status?: string;
    channel?: string;
    show?: string;
    q?: string;
  }>;
}) {
  const { status, channel, show, q } = await searchParams;
  const search = (q ?? "").trim();
  // Voided orders are mistakes, so they are out of the way rather than gone:
  // findable on purpose, never in the way by accident.
  const showVoided = show === "voided";
  const active = status && ORDER_STATUSES.includes(status as OrderStatus) ? status : "all";
  const activeChannel =
    channel && channel in CHANNEL_LABELS ? (channel as SalesChannel) : "all";

  // Searching and filtering are one question, so they are one query. Doing it
  // in the database also means a search reaches every order rather than only
  // the most recent page of them.
  const supabase = createAdminClient();
  const { data } = await supabase.rpc("search_orders", {
    p_query: search || null,
    p_status: active === "all" ? null : active,
    p_channel: activeChannel === "all" ? null : activeChannel,
    p_voided: showVoided,
    p_limit: 200,
  });
  const orders = (data ?? []) as Order[];

  /** This page's own URL, keeping whatever filters are already on. */
  function href(overrides: Record<string, string | null>) {
    const params = new URLSearchParams();
    const merged: Record<string, string | null> = {
      status: active === "all" ? null : active,
      channel: activeChannel === "all" ? null : activeChannel,
      show: showVoided ? "voided" : null,
      q: search || null,
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    const query = params.toString();
    return query ? `/admin/orders?${query}` : "/admin/orders";
  }

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Every order in one place, wherever it came from — the website, the counter, or a message. Move each one along as you roast, pack and ship it."
      />

      <form className="mb-4 flex gap-2" action="/admin/orders">
        {active !== "all" && <input type="hidden" name="status" value={active} />}
        {activeChannel !== "all" && (
          <input type="hidden" name="channel" value={activeChannel} />
        )}
        {showVoided && <input type="hidden" name="show" value="voided" />}
        <input
          name="q"
          defaultValue={search}
          className="input max-w-sm"
          placeholder="Reference, name, phone, handle, tracking…"
          aria-label="Search orders"
        />
        <button type="submit" className="btn-secondary px-4">
          Search
        </button>
        {search && (
          <Link href={href({ q: null })} className="btn-ghost px-3 text-sm">
            Clear
          </Link>
        )}
      </form>

      <nav className="mb-3 flex flex-wrap gap-2" aria-label="Sales channel">
        {[
          { value: "all", label: "Everywhere" },
          ...Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label })),
        ].map((option) => (
          <Link
            key={option.value}
            href={href({ channel: option.value === "all" ? null : option.value })}
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
            href={href({
              status: filter.value === "all" ? null : filter.value,
              show: null,
            })}
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
          href={href({ show: showVoided ? null : "voided", status: null })}
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
                    {order.shipping_address &&
                      !addressIsComplete(order.shipping_address) && (
                        <span
                          className="ml-1.5 text-xs text-amber-700"
                          title="Saved without a full address — it cannot be given a tracking number yet."
                        >
                          address to come
                        </span>
                      )}
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
          {search
            ? `Nothing matches “${search}”.`
            : showVoided
              ? "Nothing has been voided."
              : "No orders with that status."}
        </EmptyRow>
      )}
    </div>
  );
}
