import Link from "next/link";
import { Mail } from "lucide-react";
import { EmptyRow, PageHeader } from "@/components/admin/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { TIER_LABELS, TIER_STYLES } from "@/lib/loyalty";
import type { Profile } from "@/lib/types";
import { cn, formatDate, formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  const supabase = createAdminClient();

  const [{ data: profiles }, { data: orders }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("orders").select("user_id, total_idr, paid_at").not("paid_at", "is", null),
  ]);

  const rows = (profiles ?? []) as Profile[];
  const spendByUser = new Map<string, { count: number; total: number }>();
  for (const order of (orders ?? []) as { user_id: string | null; total_idr: number }[]) {
    if (!order.user_id) continue;
    const current = spendByUser.get(order.user_id) ?? { count: 0, total: 0 };
    spendByUser.set(order.user_id, {
      count: current.count + 1,
      total: current.total + order.total_idr,
    });
  }

  return (
    <div>
      <PageHeader
        title="Customers & loyalty"
        description="Everyone with an account, their points and their tier."
        action={
          <Link href="/admin/customers/subscribers" className="btn-secondary">
            <Mail className="h-4 w-4" /> Mailing list
          </Link>
        }
      />

      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-sea-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-sea-200 text-left text-xs uppercase tracking-wider text-sea-800">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Orders</th>
                <th className="px-4 py-3 font-medium">Spend</th>
                <th className="px-4 py-3 font-medium">Points</th>
                <th className="px-4 py-3 font-medium">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sea-200">
              {rows.map((profile) => {
                const stats = spendByUser.get(profile.id) ?? { count: 0, total: 0 };
                return (
                  <tr key={profile.id} className="hover:bg-sea-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/customers/${profile.id}`}
                        className="font-medium hover:underline"
                      >
                        {profile.display_name || profile.email || "Customer"}
                      </Link>
                      <p className="text-xs text-sea-800">{profile.email}</p>
                      {profile.is_admin && (
                        <span className="badge mt-1 bg-sea-800 text-cream">Admin</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sea-800">
                      {formatDate(profile.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sea-800">{stats.count}</td>
                    <td className="px-4 py-3 text-sea-800">{formatIDR(stats.total)}</td>
                    <td className="px-4 py-3 font-medium">{profile.loyalty_points}</td>
                    <td className="px-4 py-3">
                      <span className={cn("badge", TIER_STYLES[profile.tier])}>
                        {TIER_LABELS[profile.tier]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyRow>No customer accounts yet.</EmptyRow>
      )}
    </div>
  );
}
