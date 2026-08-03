import Link from "next/link";
import { OrderStatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { TIER_LABELS, TIER_STYLES, tierProgress } from "@/lib/loyalty";
import { getProducts, getSiteSettings } from "@/lib/queries";
import { ProductCard } from "@/components/shop/product-card";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";
import { cn, formatDate, formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AccountOverviewPage() {
  const session = await requireUser();
  const supabase = await createClient();

  const [{ data: orderRows }, settings, recommendations] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false }),
    getSiteSettings(),
    getProducts({ featuredOnly: true, limit: 4 }),
  ]);

  const orders = (orderRows ?? []) as Order[];
  const paidOrders = orders.filter((order) =>
    ["paid", "roasting", "shipped", "completed"].includes(order.status),
  );
  const activeOrders = orders.filter((order) =>
    ["pending", "paid", "roasting", "shipped"].includes(order.status),
  );
  const lifetimeSpend = paidOrders.reduce((sum, order) => sum + order.total_idr, 0);

  const profile = session.profile;
  const progress = tierProgress(profile?.lifetime_points ?? 0, settings);

  return (
    <div className="space-y-10">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Orders" value={String(paidOrders.length)} />
        <Stat label="Lifetime spend" value={formatIDR(lifetimeSpend)} />
        <Stat label="Points balance" value={String(profile?.loyalty_points ?? 0)} />
        <div className="card p-5">
          <p className="text-sm text-bark-600">Tier</p>
          <p className="mt-2">
            <span className={cn("badge text-sm", TIER_STYLES[progress.tier])}>
              {TIER_LABELS[progress.tier]}
            </span>
          </p>
        </div>
      </section>

      <section className="card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl">Loyalty</h2>
          <p className="text-sm text-bark-600">
            1 point per {formatIDR(settings.loyalty_rupiah_per_point)} spent
          </p>
        </div>

        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-bark-100">
            <div
              className="h-full rounded-full bg-bark-700 transition-all"
              style={{ width: `${Math.min(100, Math.max(2, progress.percent))}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-bark-600">
            {progress.nextTier
              ? `${progress.pointsToNext} more points to ${TIER_LABELS[progress.nextTier]}.`
              : "You are at the top tier. Thank you, genuinely."}
          </p>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl">Active orders</h2>
          <Link href="/account/orders" className="text-sm underline underline-offset-4">
            All orders
          </Link>
        </div>

        {activeOrders.length ? (
          <ul className="mt-4 divide-y divide-bark-200/70 card">
            {activeOrders.slice(0, 5).map((order) => (
              <li key={order.id}>
                <Link
                  href={`/order/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-bark-50"
                >
                  <div>
                    <p className="font-medium">{order.human_ref}</p>
                    <p className="text-sm text-bark-500">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <OrderStatusBadge status={order.status} />
                    <span className="font-medium">{formatIDR(order.total_idr)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 card p-6 text-sm text-bark-600">
            Nothing in progress right now.
          </p>
        )}
      </section>

      {recommendations.length > 0 && (
        <section>
          <h2 className="text-xl">Picked for you</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {recommendations.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-bark-600">{label}</p>
      <p className="mt-2 font-serif text-2xl">{value}</p>
    </div>
  );
}
