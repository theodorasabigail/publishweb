import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EmptyRow, Field, PageHeader, Panel } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/status-badge";
import {
  adjustLoyaltyPoints,
  setAdminFlag,
  setCustomerTier,
} from "@/app/admin/_actions/customers";
import { createAdminClient } from "@/lib/supabase/admin";
import { TIER_LABELS, TIER_STYLES } from "@/lib/loyalty";
import type { LoyaltyLedgerEntry, Order, Profile } from "@/lib/types";
import { cn, formatDate, formatDateTime, formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: profile }, { data: orders }, { data: ledger }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("orders")
      .select("*")
      .eq("user_id", id)
      .is("voided_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("loyalty_ledger")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!profile) notFound();
  const customer = profile as Profile;
  const orderRows = (orders ?? []) as Order[];
  const ledgerRows = (ledger ?? []) as LoyaltyLedgerEntry[];

  const paid = orderRows.filter((order) => order.paid_at);
  const spend = paid.reduce((sum, order) => sum + order.total_idr, 0);

  return (
    <div>
      <Link
        href="/admin/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-sea-800 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All customers
      </Link>

      <PageHeader
        title={customer.display_name || customer.email || "Customer"}
        description={`${customer.email ?? "no email"} · joined ${formatDate(customer.created_at)}`}
        action={
          <span className={cn("badge", TIER_STYLES[customer.tier])}>
            {TIER_LABELS[customer.tier]}
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric label="Paid orders" value={String(paid.length)} />
            <Metric label="Lifetime spend" value={formatIDR(spend)} />
            <Metric label="Points balance" value={String(customer.loyalty_points)} />
          </div>

          <Panel title="Orders">
            {orderRows.length ? (
              <ul className="divide-y divide-sea-200">
                {orderRows.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:opacity-70"
                    >
                      <div>
                        <p className="font-medium">{order.human_ref}</p>
                        <p className="text-xs text-sea-800">
                          {formatDate(order.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <OrderStatusBadge status={order.status} />
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

          <Panel title="Points history">
            {ledgerRows.length ? (
              <ul className="divide-y divide-sea-200 text-sm">
                {ledgerRows.map((entry) => (
                  <li key={entry.id} className="flex justify-between gap-4 py-2.5">
                    <div>
                      <p>{entry.reason}</p>
                      <p className="text-xs text-sea-800">
                        {formatDateTime(entry.created_at)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 font-medium",
                        entry.points > 0 ? "text-emerald-700" : "text-red-700",
                      )}
                    >
                      {entry.points > 0 ? "+" : ""}
                      {entry.points}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRow>No points movement yet.</EmptyRow>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Adjust points">
            <form action={adjustLoyaltyPoints} className="space-y-3">
              <input type="hidden" name="user_id" value={customer.id} />
              <Field label="Points" hint="Use a negative number to take points away.">
                <input type="number" name="points" className="input" defaultValue={0} />
              </Field>
              <Field label="Reason">
                <input
                  name="reason"
                  className="input"
                  placeholder="Goodwill after a late delivery"
                />
              </Field>
              <button type="submit" className="btn-primary w-full py-2 text-xs">
                Apply adjustment
              </button>
            </form>
          </Panel>

          <Panel title="Tier">
            <form action={setCustomerTier} className="space-y-3">
              <input type="hidden" name="user_id" value={customer.id} />
              <select name="tier" className="input" defaultValue={customer.tier}>
                <option value="bronze">Bronze</option>
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
              </select>
              <button type="submit" className="btn-secondary w-full py-2 text-xs">
                Set tier
              </button>
              <p className="text-xs text-sea-800">
                Tiers normally follow lifetime points. Setting one by hand holds
                until their next points change.
              </p>
            </form>
          </Panel>

          <Panel title="Dashboard access">
            <form action={setAdminFlag} className="space-y-3">
              <input type="hidden" name="user_id" value={customer.id} />
              <input type="hidden" name="is_admin" value={customer.is_admin ? "false" : "true"} />
              <p className="text-sm text-sea-800">
                {customer.is_admin
                  ? "This person can open the admin dashboard."
                  : "This person is a normal customer."}
              </p>
              <button
                type="submit"
                className={customer.is_admin ? "btn-danger w-full py-2 text-xs" : "btn-secondary w-full py-2 text-xs"}
              >
                {customer.is_admin ? "Remove admin access" : "Make an admin"}
              </button>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-sea-200 bg-white p-4">
      <p className="text-sm text-sea-800">{label}</p>
      <p className="mt-1.5 font-serif text-xl">{value}</p>
    </div>
  );
}
