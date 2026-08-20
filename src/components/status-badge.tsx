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

const ORDER_LABELS: Record<OrderStatus, string> = {
  pending: "Awaiting payment",
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

export function RoastingStatusBadge({ status }: { status: RoastingStatus }) {
  return (
    <span className={cn("badge capitalize", ROASTING_STYLES[status])}>{status}</span>
  );
}
