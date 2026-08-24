import type { OrderStatus, RoastingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORDER_STYLES: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  roasting: "bg-orange-100 text-orange-800",
  shipped: "bg-sky-100 text-sky-800",
  completed: "bg-sea-100 text-sea-800",
  cancelled: "bg-red-100 text-red-800",
};

/**
 * Two labels, one for the fulfilment status and one for a badge that only
 * shows on unpaid orders. "Awaiting payment" used to be the label for status
 * `pending`, but a shipped order can be awaiting payment too when the shop
 * ships first and collects later. So payment is its own dimension now, and
 * `pending` reads plainly as "Awaiting fulfilment" -- what the fulfilment
 * status field itself is telling you.
 */
const ORDER_LABELS: Record<OrderStatus, string> = {
  pending: "Awaiting fulfilment",
  paid: "Paid",
  roasting: "Roasting",
  shipped: "Shipped",
  completed: "Completed",
  cancelled: "Cancelled",
};

const ROASTING_STYLES: Record<RoastingStatus, string> = {
  new: "bg-sky-100 text-sky-800",
  quoted: "bg-amber-100 text-amber-800",
  accepted: "bg-emerald-100 text-emerald-800",
  declined: "bg-red-100 text-red-800",
  done: "bg-sea-100 text-sea-800",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={cn("badge", ORDER_STYLES[status])}>{ORDER_LABELS[status]}</span>;
}

/**
 * Payment state, the second half of "where is this order".
 *
 * Renders only when there is something to say: an unpaid, live order gets an
 * amber "Awaiting payment" badge; a paid one gets nothing, because the money
 * being in is the ordinary case and does not deserve a chip of its own. A
 * cancelled or voided order is off the books either way -- it collects no
 * payment badge because whether it was paid is no longer the point.
 */
export function PaymentBadge({
  paidAt,
  status,
  voidedAt,
}: {
  paidAt: string | null;
  status: OrderStatus;
  voidedAt?: string | null;
}) {
  if (paidAt || status === "cancelled" || voidedAt) return null;
  return (
    <span className="badge bg-amber-100 text-amber-800">Awaiting payment</span>
  );
}

/**
 * Both badges together. Handy where a caller just wants "the current position
 * of this order" without composing the two by hand every time.
 */
export function OrderPositionBadges({
  status,
  paidAt,
  voidedAt,
}: {
  status: OrderStatus;
  paidAt: string | null;
  voidedAt?: string | null;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <OrderStatusBadge status={status} />
      <PaymentBadge status={status} paidAt={paidAt} voidedAt={voidedAt} />
    </span>
  );
}

export function RoastingStatusBadge({ status }: { status: RoastingStatus }) {
  return (
    <span className={cn("badge capitalize", ROASTING_STYLES[status])}>{status}</span>
  );
}
