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

export default async function AccountOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ admin?: string }>;
}) {
  const { admin } = await searchParams;
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
      {admin === "denied" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <p className="font-medium text-amber-900">
            This account does not have dashboard access.
          </p>
          <p className="mt-2 text-sm text-amber-900">
            You are signed in as <strong>{session.email}</strong>, but that
            account has not been made an admin. Sign-in worked — this is the
            step after it.
          </p>
          <p className="mt-3 text-sm text-amber-900">
            If you are the owner setting this up for the first time, add this in
            Vercel → Settings → Environment Variables, redeploy, then come back
            to <span className="font-mono text-xs">/admin</span>:
          </p>
          <div className="mt-2 rounded-lg bg-white/70 p-3 font-mono text-xs text-amber-900">
            ADMIN_BOOTSTRAP_EMAIL = {session.email}
          </div>
          <p className="mt-3 text-sm text-amber-900">
            That is only needed once. Clear it afterwards, and grant everyone
            else with a button in Admin → Customers.
          </p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Orders" value={String(paidOrders.length)} />
        <Stat label="Lifetime spend" value={formatIDR(lifetimeSpend)} />
        <Stat label="Points balance" value={String(profile?.loyalty_points ?? 0)} />
        <div className="card p-5">
          <p className="text-sm text-sea-800">Tier</p>
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
          <p className="text-sm text-sea-800">
            1 point per {formatIDR(settings.loyalty_rupiah_per_point)} spent
          </p>
        </div>

        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-sea-100">
            <div
              className="h-full rounded-full bg-sea-700 transition-all"
              style={{ width: `${Math.min(100, Math.max(2, progress.percent))}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-sea-800">
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
          <ul className="mt-4 divide-y divide-sea-200/70 card">
            {activeOrders.slice(0, 5).map((order) => (
              <li key={order.id}>
                <Link
                  href={`/order/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-sea-50"
                >
                  <div>
                    <p className="font-medium">{order.human_ref}</p>
                    <p className="text-sm text-sea-800">{formatDate(order.created_at)}</p>
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
          <p className="mt-4 card p-6 text-sm text-sea-800">
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
      <p className="text-sm text-sea-800">{label}</p>
      <p className="mt-2 font-serif text-2xl">{value}</p>
    </div>
  );
}
