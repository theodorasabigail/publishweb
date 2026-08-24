import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteSettings } from "@/lib/queries";
import type { OrderWithItems } from "@/lib/types";
import { formatDate, formatDateTime, formatIDR } from "@/lib/utils";
import { manualTransferDetails } from "@/lib/payments/manual-transfer";
import { InvoiceActions } from "./invoice-actions";

export const dynamic = "force-dynamic";

/**
 * A print-and-save receipt for an order.
 *
 * Plain HTML, styled with @media print, on purpose. A headless-Chromium PDF
 * pipeline would be real weight -- extra megabytes on every deploy, cold-start
 * penalties on a route the operator uses in ones and twos. Every browser
 * already renders a good PDF from the print dialog, and it does it against
 * exactly what the operator can see, which is easier to trust than a file
 * generated somewhere else.
 *
 * Nothing on this page depends on the admin chrome, so it lays out on the
 * whole page rather than inside the admin frame -- and the operator sees the
 * receipt as it will print, before pressing print.
 */
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = createAdminClient();
  const [{ data }, settings] = await Promise.all([
    supabase
      .from("orders")
      .select("*, order_items (*)")
      .eq("id", id)
      .maybeSingle(),
    getSiteSettings(supabase),
  ]);

  const order = data as OrderWithItems | null;
  if (!order) notFound();

  const address = order.shipping_address;
  const transfer = manualTransferDetails();
  const businessName = transfer.accountName ?? "Publish Coffee Roasters";

  return (
    <div className="mx-auto max-w-2xl bg-white px-8 py-10 text-ink print:max-w-none print:px-0 print:py-0">
      {/* Not printed. Sits above the invoice while the operator is looking at
          it, and hidden by @media print so it never lands on paper. */}
      <InvoiceActions />

      <header className="flex items-start justify-between gap-6 border-b border-sea-300 pb-6">
        <div>
          <p className="font-serif text-2xl">{businessName}</p>
          {settings.contact_email && (
            <p className="mt-1 text-sm text-sea-800">{settings.contact_email}</p>
          )}
          {settings.whatsapp_number && (
            <p className="text-sm text-sea-800">
              WhatsApp {settings.whatsapp_number}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-sea-800">Receipt</p>
          <p className="mt-1 font-serif text-xl">{order.human_ref}</p>
          <p className="mt-1 text-xs text-sea-800">
            {formatDateTime(order.created_at)}
          </p>
        </div>
      </header>

      <section className="mt-6 grid gap-6 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-sea-800">To</p>
          {address ? (
            <address className="mt-1 not-italic leading-relaxed">
              <strong>{address.recipient_name}</strong>
              <br />
              {address.line1}
              {address.line2 && (
                <>
                  <br />
                  {address.line2}
                </>
              )}
              {(address.village || address.district) && (
                <>
                  <br />
                  {[address.village, address.district].filter(Boolean).join(", ")}
                </>
              )}
              <br />
              {address.city}
              {address.province && `, ${address.province}`}{" "}
              {address.postal_code}
              <br />
              {address.country}
              <br />
              {address.phone}
            </address>
          ) : (
            <p className="mt-1 text-sea-700">Collected at the counter.</p>
          )}
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-sea-800">Details</p>
          <dl className="mt-1 space-y-0.5">
            <Row label="Placed" value={formatDateTime(order.created_at)} />
            {order.paid_at && <Row label="Paid" value={formatDateTime(order.paid_at)} />}
            {order.shipped_at && (
              <Row label="Shipped" value={formatDateTime(order.shipped_at)} />
            )}
            {order.ship_after && (
              <Row label="Ships on / after" value={formatDate(order.ship_after)} />
            )}
            {order.payment_method && (
              <Row label="Payment" value={order.payment_method} />
            )}
            {order.tracking_number && (
              <Row label="Tracking" value={order.tracking_number} />
            )}
          </dl>
        </div>
      </section>

      <table className="mt-8 w-full text-sm">
        <thead className="border-b border-sea-300 text-left text-xs uppercase tracking-wider text-sea-800">
          <tr>
            <th className="pb-2 font-medium">Item</th>
            <th className="pb-2 text-right font-medium">Qty</th>
            <th className="pb-2 text-right font-medium">Unit</th>
            <th className="pb-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sea-200">
          {order.order_items.map((item) => (
            <tr key={item.id}>
              <td className="py-2.5">
                {item.name_snapshot}
                <span className="block text-xs text-sea-800">
                  {item.size_snapshot}
                </span>
              </td>
              <td className="py-2.5 text-right">{item.quantity}</td>
              <td className="py-2.5 text-right">{formatIDR(item.unit_price_idr)}</td>
              <td className="py-2.5 text-right">
                {formatIDR(item.unit_price_idr * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-5 ml-auto max-w-xs space-y-1 text-sm">
        <Total label="Subtotal" value={formatIDR(order.subtotal_idr)} />
        {order.discount_idr > 0 && (
          <Total
            label={
              order.discount_reason
                ? `Discount — ${order.discount_reason}`
                : "Discount"
            }
            value={`−${formatIDR(order.discount_idr)}`}
            emphasis="good"
          />
        )}
        {(order.shipping_idr > 0 || order.channel === "online") && (
          <Total label="Shipping" value={formatIDR(order.shipping_idr)} />
        )}
        {order.unique_code > 0 && (
          <Total label="Kode unik" value={String(order.unique_code)} />
        )}
        <Total label="Total" value={formatIDR(order.total_idr)} strong />
      </dl>

      {order.customer_note && (
        <section className="mt-8 border-t border-sea-200 pt-4 text-sm">
          <p className="text-xs uppercase tracking-wider text-sea-800">Note</p>
          <p className="mt-1 whitespace-pre-line text-sea-700">
            {order.customer_note}
          </p>
        </section>
      )}

      <footer className="mt-10 border-t border-sea-200 pt-4 text-center text-xs text-sea-800">
        Terima kasih telah memesan.
      </footer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-sea-800">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Total({
  label,
  value,
  strong = false,
  emphasis,
}: {
  label: string;
  value: string;
  strong?: boolean;
  emphasis?: "good";
}) {
  return (
    <div
      className={[
        "flex justify-between",
        strong ? "border-t border-sea-300 pt-2 text-base font-semibold" : "",
        emphasis === "good" ? "text-emerald-700" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
