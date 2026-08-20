import { EmptyRow, Field, PageHeader, Panel } from "@/components/admin/ui";
import { resolvePaymentEvent } from "@/app/admin/_actions/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Order, PaymentEvent } from "@/lib/types";
import { formatDateTime, formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const supabase = createAdminClient();

  const [{ data: events }, { data: pending }] = await Promise.all([
    supabase
      .from("payment_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("orders")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const allEvents = (events ?? []) as PaymentEvent[];
  const unmatched = allEvents.filter((event) => !event.is_matched && !event.is_resolved);
  const rest = allEvents.filter((event) => event.is_matched || event.is_resolved);
  const pendingOrders = (pending ?? []) as Order[];

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Money that arrived but could not be tied to an order automatically."
      />

      <Panel
        title={`Needs your attention (${unmatched.length})`}
        description="Usually a transfer where the customer typed the wrong amount, so the unique code did not match."
      >
        {unmatched.length ? (
          <div className="space-y-4">
            {unmatched.map((event) => (
              <form
                key={event.id}
                action={resolvePaymentEvent}
                className="rounded-lg border border-amber-300 bg-amber-50/60 p-4"
              >
                <input type="hidden" name="event_id" value={event.id} />
                <input type="hidden" name="reference" value={event.external_id ?? ""} />

                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-serif text-xl">{formatIDR(event.amount_idr ?? 0)}</p>
                  <p className="text-xs text-bark-600">
                    {event.provider} · {formatDateTime(event.created_at)}
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field
                    label="Match it to an order"
                    hint="Marking it here settles the order exactly as an automatic payment would."
                  >
                    <select name="order_id" className="input" defaultValue="">
                      <option value="">Not a payment — just dismiss it</option>
                      {pendingOrders.map((order) => (
                        <option key={order.id} value={order.id}>
                          {order.human_ref} — {formatIDR(order.total_idr)} —{" "}
                          {order.shipping_address?.recipient_name ?? "guest"}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <button type="submit" className="btn-primary py-2 text-xs">
                    Resolve
                  </button>
                </div>
              </form>
            ))}
          </div>
        ) : (
          <EmptyRow>Nothing unmatched. Every payment found its order.</EmptyRow>
        )}
      </Panel>

      <Panel title="Recent payment events" className="mt-6">
        {rest.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-bark-600">
                <tr>
                  <th className="pb-2 pr-4 font-medium">When</th>
                  <th className="pb-2 pr-4 font-medium">Provider</th>
                  <th className="pb-2 pr-4 font-medium">Reference</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bark-200">
                {rest.map((event) => (
                  <tr key={event.id}>
                    <td className="py-2.5 pr-4 text-bark-600">
                      {formatDateTime(event.created_at)}
                    </td>
                    <td className="py-2.5 pr-4">{event.provider}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-bark-600">
                      {event.external_id ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4">{event.status ?? "—"}</td>
                    <td className="py-2.5 text-right font-medium">
                      {formatIDR(event.amount_idr ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyRow>No payment events recorded yet.</EmptyRow>
        )}
      </Panel>
    </div>
  );
}
