import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { OrderStatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { OrderWithItems } from "@/lib/types";
import { formatDate, formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AccountOrdersPage() {
  const session = await requireUser("/account/orders");
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select("*, order_items (*)")
    .eq("user_id", session.userId)
    // A voided order was a mistake on the shop's side. It should never have
    // been the customer's order, so it is not in the customer's history.
    .is("voided_at", null)
    .order("created_at", { ascending: false });

  const orders = (data ?? []) as OrderWithItems[];

  if (!orders.length) {
    return (
      <EmptyState
        title="No orders yet"
        description="Once you place an order it will show up here, with its status and tracking."
        actionLabel="Browse the roast list"
        actionHref="/shop"
      />
    );
  }

  return (
    <ul className="space-y-4">
      {orders.map((order) => (
        <li key={order.id} className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sea-200/70 px-5 py-4">
            <div>
              <Link href={`/order/${order.id}`} className="font-medium hover:underline">
                {order.human_ref}
              </Link>
              <p className="text-sm text-sea-800">{formatDate(order.created_at)}</p>
            </div>
            <div className="flex items-center gap-4">
              <OrderStatusBadge status={order.status} />
              <span className="font-medium">{formatIDR(order.total_idr)}</span>
            </div>
          </div>

          <ul className="px-5 py-4 text-sm text-sea-700">
            {order.order_items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-1">
                <span>
                  {item.name_snapshot}{" "}
                  <span className="text-sea-800">
                    · {item.size_snapshot} × {item.quantity}
                  </span>
                </span>
                <span>{formatIDR(item.unit_price_idr * item.quantity)}</span>
              </li>
            ))}
          </ul>

          {order.tracking_number && (
            <p className="border-t border-sea-200/70 px-5 py-3 text-sm">
              <span className="text-sea-800">Tracking:</span>{" "}
              <span className="font-mono">{order.tracking_number}</span>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
