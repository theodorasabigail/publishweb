import type { Metadata } from "next";
import { listZones } from "@/lib/shipping";
import { createStaticClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { formatIDR } from "@/lib/utils";

/*
 * Revalidation is a backstop, not the update mechanism: every admin action
 * calls revalidatePath, so edits appear immediately. This timer only catches
 * changes made outside the admin and scheduled posts going live — so it is set
 * long, because each expiry costs a fresh set of database queries.
 */
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Shipping",
  description:
    "Flat-rate shipping across Indonesia and worldwide. Current rates and delivery estimates by zone.",
  alternates: { canonical: "/shipping" },
};

export default async function ShippingPage() {
  const zones = isSupabaseConfigured() ? await listZones(createStaticClient()) : [];
  const domestic = zones.filter((zone) => zone.is_domestic);
  const international = zones.filter((zone) => !zone.is_domestic);

  return (
    <div className="container-page max-w-3xl py-16">
      <h1 className="text-5xl">Shipping</h1>
      <p className="mt-4 text-lg text-bark-600">
        Flat rates by zone. What you see at checkout is what you pay — no
        adjustments afterwards.
      </p>

      {domestic.length > 0 && (
        <ZoneTable title="Indonesia" zones={domestic} />
      )}
      {international.length > 0 && (
        <ZoneTable title="International" zones={international} />
      )}

      <div className="prose mt-12 max-w-none">
        <h2>How it works</h2>
        <ul>
          <li>Rates are per order, based on total parcel weight.</li>
          <li>
            Orders over the free-shipping threshold in a zone ship free — the
            threshold shows in the table above where one applies.
          </li>
          <li>
            Bags are roasted to order and dispatched within 48 hours. Delivery
            estimates start from dispatch, not from checkout.
          </li>
          <li>
            International customers are responsible for any import duties or
            taxes charged on arrival.
          </li>
        </ul>
      </div>
    </div>
  );
}

function ZoneTable({
  title,
  zones,
}: {
  title: string;
  zones: Awaited<ReturnType<typeof listZones>>;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-2xl">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-bark-200 text-xs uppercase tracking-wider text-bark-500">
            <tr>
              <th className="py-3 pr-4 font-medium">Zone</th>
              <th className="py-3 pr-4 font-medium">Up to 1kg</th>
              <th className="py-3 pr-4 font-medium">Over 1kg</th>
              <th className="py-3 font-medium">Estimate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bark-200/70">
            {zones.map((zone) => (
              <tr key={zone.id}>
                <td className="py-3 pr-4">
                  <p className="font-medium text-bark-900">{zone.name}</p>
                  {zone.free_shipping_over_idr && (
                    <p className="text-xs text-emerald-700">
                      Free over {formatIDR(zone.free_shipping_over_idr)}
                    </p>
                  )}
                </td>
                <td className="py-3 pr-4">{formatIDR(zone.base_rate_idr)}</td>
                <td className="py-3 pr-4">
                  {zone.heavy_rate_idr ? formatIDR(zone.heavy_rate_idr) : "—"}
                </td>
                <td className="py-3 text-bark-600">{zone.delivery_estimate ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
