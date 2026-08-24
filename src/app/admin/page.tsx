import Link from "next/link";
import { EmptyRow, PageHeader, Panel, StatCard } from "@/components/admin/ui";
import { OrderPositionBadges } from "@/components/status-badge";
import { isSupabaseConfigured } from "@/lib/env";
import { getPaymentProvider } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Order, ProductVariant, RoastingRequest } from "@/lib/types";
import { formatDate, formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  // The layout already shows setup guidance in this case; returning early
  // keeps this page from querying a database that does not exist yet.
  if (!isSupabaseConfigured()) return null;

  const supabase = createAdminClient();
  // react-hooks/purity assumes a client component that may re-render. This is
  // an async Server Component marked force-dynamic: it runs once per request,
  // and reading the clock is exactly what "last 30 days" means.
  // eslint-disable-next-line react-hooks/purity
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: recentOrders },
    { data: paidOrders },
    { count: pendingCount },
    { data: newRequests },
    { data: lowStock },
    { count: unmatchedCount },
  ] = await Promise.all([
    supabase.from("orders")
      .select("*")
      .is("voided_at", null)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("orders")
      .select("total_idr")
      .is("voided_at", null)
      .gte("paid_at", thirtyDaysAgo)
      .not("paid_at", "is", null),
    supabase.from("orders")
      .select("id", { count: "exact", head: true })
      .is("voided_at", null)
      .is("paid_at", null)
      .neq("status", "cancelled"),
    supabase.from("roasting_requests").select("*").eq("status", "new").order("created_at", { ascending: false }).limit(5),
    supabase
      .from("product_variants")
      .select("*, products ( name, slug )")
      .lte("stock", 5)
      .eq("is_active", true)
      .order("stock")
      .limit(8),
    supabase
      .from("payment_events")
      .select("id", { count: "exact", head: true })
      .eq("is_matched", false)
      .eq("is_resolved", false),
  ]);

  const orders = (recentOrders ?? []) as Order[];
  const revenue = ((paidOrders ?? []) as { total_idr: number }[]).reduce(
    (sum, order) => sum + order.total_idr,
    0,
  );
  const requests = (newRequests ?? []) as RoastingRequest[];
  const variants = (lowStock ?? []) as (ProductVariant & {
    products: { name: string; slug: string } | null;
  })[];

  const toRoast = orders.filter((order) => order.status === "paid").length;
  let providerLabel = "not configured";
  try {
    providerLabel = getPaymentProvider().label;
  } catch {
    // A missing/invalid PAYMENT_PROVIDER must not take the dashboard down.
  }

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Everything that needs your attention today."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Paid, ready to roast"
          value={toRoast}
          href="/admin/orders?status=paid"
          tone={toRoast > 0 ? "good" : "default"}
        />
        <StatCard
          label="Awaiting payment"
          value={pendingCount ?? 0}
          href="/admin/orders?status=pending"
        />
        <StatCard
          label="Revenue, last 30 days"
          value={formatIDR(revenue)}
          hint="Confirmed payments only"
        />
        <StatCard
          label="New roasting requests"
          value={requests.length}
          href="/admin/roasting"
          tone={requests.length > 0 ? "warning" : "default"}
        />
      </div>

      {(unmatchedCount ?? 0) > 0 && (
        <Link
          href="/admin/payments"
          className="mt-4 block rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900 hover:border-amber-400"
        >
          <strong>{unmatchedCount} unmatched payment{unmatchedCount === 1 ? "" : "s"}</strong>{" "}
          — money arrived that we could not tie to an order. Review it →
        </Link>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Recent orders">
          {orders.length ? (
            <ul className="divide-y divide-sea-200">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:opacity-70"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{order.human_ref}</p>
                      <p className="text-xs text-sea-800">
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <OrderPositionBadges status={order.status} paidAt={order.paid_at} voidedAt={order.voided_at} />
                      <span className="text-sm font-medium">
                        {formatIDR(order.total_idr)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyRow>No orders yet.</EmptyRow>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Low stock" description="Five bags or fewer left.">
            {variants.length ? (
              <ul className="divide-y divide-sea-200">
                {variants.map((variant) => (
                  <li key={variant.id} className="flex justify-between gap-3 py-2.5">
                    <span className="truncate text-sm">
                      {variant.products?.name ?? "—"}{" "}
                      <span className="text-sea-800">· {variant.size}</span>
                    </span>
                    <span
                      className={`shrink-0 text-sm font-medium ${
                        variant.stock === 0 ? "text-red-700" : "text-amber-700"
                      }`}
                    >
                      {variant.stock} left
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRow>Stock levels are healthy.</EmptyRow>
            )}
          </Panel>

          <Panel title="New roasting requests">
            {requests.length ? (
              <ul className="divide-y divide-sea-200">
                {requests.map((request) => (
                  <li key={request.id}>
                    <Link
                      href={`/admin/roasting`}
                      className="flex justify-between gap-3 py-2.5 hover:opacity-70"
                    >
                      <span className="truncate text-sm">
                        {request.contact_name}{" "}
                        <span className="text-sea-800">
                          · {request.green_bean_origin}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm text-sea-800">
                        {request.quantity_kg} kg
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRow>Nothing new.</EmptyRow>
            )}
          </Panel>
        </div>
      </div>

      <p className="mt-6 text-xs text-sea-800">
        Payments are running through: <strong>{providerLabel}</strong>.
      </p>
    </div>
  );
}
