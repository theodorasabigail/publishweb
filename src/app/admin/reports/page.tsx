import Link from "next/link";
import { EmptyRow, PageHeader, Panel, StatCard } from "@/components/admin/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { cn, formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RANGES = {
  today: { label: "Today", days: 1 },
  week: { label: "Last 7 days", days: 7 },
  month: { label: "Last 30 days", days: 30 },
} as const;

type RangeKey = keyof typeof RANGES;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  if (!isSupabaseConfigured()) return null;

  const { range } = await searchParams;
  const key: RangeKey = range === "week" || range === "month" ? range : "today";

  // Day boundaries in Western Indonesia Time, which is when the shop's day
  // actually starts and ends -- not UTC.
  const now = new Date();
  const wibNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const startOfWibDay = Date.UTC(
    wibNow.getUTCFullYear(),
    wibNow.getUTCMonth(),
    wibNow.getUTCDate(),
  ) - 7 * 60 * 60 * 1000;

  const to = new Date(startOfWibDay + 24 * 60 * 60 * 1000);
  const from = new Date(startOfWibDay - (RANGES[key].days - 1) * 24 * 60 * 60 * 1000);

  const supabase = createAdminClient();
  const [{ data: summaryRows }, { data: productRows }] = await Promise.all([
    supabase.rpc("sales_summary", { p_from: from.toISOString(), p_to: to.toISOString() }),
    supabase.rpc("product_sales_report", {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    }),
  ]);

  const summary = (summaryRows ?? []) as {
    channel: "online" | "pos";
    payment_method: string;
    order_count: number;
    gross_idr: number;
  }[];
  const bySize = (productRows ?? []) as {
    product_name: string;
    size: string;
    units_sold: number;
    gross_idr: number;
    online_units: number;
    pos_units: number;
  }[];

  const total = summary.reduce((sum, row) => sum + Number(row.gross_idr), 0);
  const posTotal = summary
    .filter((row) => row.channel === "pos")
    .reduce((sum, row) => sum + Number(row.gross_idr), 0);
  const onlineTotal = total - posTotal;
  const cashTotal = summary
    .filter((row) => row.payment_method === "cash")
    .reduce((sum, row) => sum + Number(row.gross_idr), 0);
  const orderCount = summary.reduce((sum, row) => sum + Number(row.order_count), 0);

  return (
    <div>
      <PageHeader
        title="Sales"
        description="Shop and website together, so you can see the whole business in one place."
      />

      <nav className="mb-5 flex flex-wrap gap-2">
        {(Object.keys(RANGES) as RangeKey[]).map((option) => (
          <Link
            key={option}
            href={`/admin/reports?range=${option}`}
            className={cn(
              "badge",
              key === option
                ? "bg-bark-800 text-cream"
                : "border border-bark-200 bg-white text-bark-700 hover:border-bark-400",
            )}
          >
            {RANGES[option].label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total takings" value={formatIDR(total)} hint={`${orderCount} sales`} />
        <StatCard label="In the shop" value={formatIDR(posTotal)} />
        <StatCard label="Online" value={formatIDR(onlineTotal)} />
        <StatCard
          label="Cash to count"
          value={formatIDR(cashTotal)}
          hint="Should match the drawer"
          tone={cashTotal > 0 ? "good" : "default"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="How the money came in">
          {summary.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-bark-500">
                <tr>
                  <th className="pb-2 font-medium">Where</th>
                  <th className="pb-2 font-medium">Method</th>
                  <th className="pb-2 text-right font-medium">Sales</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bark-200">
                {summary.map((row) => (
                  <tr key={`${row.channel}-${row.payment_method}`}>
                    <td className="py-2.5 capitalize">
                      {row.channel === "pos" ? "Shop" : "Website"}
                    </td>
                    <td className="py-2.5 capitalize text-bark-600">
                      {row.payment_method}
                    </td>
                    <td className="py-2.5 text-right text-bark-600">{row.order_count}</td>
                    <td className="py-2.5 text-right font-medium">
                      {formatIDR(row.gross_idr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyRow>No sales in this period yet.</EmptyRow>
          )}
        </Panel>

        <Panel title="What sold" description="Both channels combined — what to roast next.">
          {bySize.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-bark-500">
                <tr>
                  <th className="pb-2 font-medium">Coffee</th>
                  <th className="pb-2 text-right font-medium">Shop</th>
                  <th className="pb-2 text-right font-medium">Web</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bark-200">
                {bySize.map((row) => (
                  <tr key={`${row.product_name}-${row.size}`}>
                    <td className="py-2.5">
                      {row.product_name}{" "}
                      <span className="text-bark-500">· {row.size}</span>
                    </td>
                    <td className="py-2.5 text-right text-bark-600">{row.pos_units}</td>
                    <td className="py-2.5 text-right text-bark-600">{row.online_units}</td>
                    <td className="py-2.5 text-right font-medium">{row.units_sold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyRow>Nothing sold in this period yet.</EmptyRow>
          )}
        </Panel>
      </div>
    </div>
  );
}
