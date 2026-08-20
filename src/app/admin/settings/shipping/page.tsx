import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { EmptyRow, Field, PageHeader, Panel } from "@/components/admin/ui";
import { CourierTest } from "@/components/admin/courier-test";
import { getShippingProvider } from "@/lib/shipping";
import { deleteShippingZone, saveShippingZone, updateShippingOrigin } from "@/app/admin/_actions/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ShippingZone, SiteSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminShippingPage() {
  const supabase = createAdminClient();
  const [{ data }, { data: settingsRow }] = await Promise.all([
    supabase.from("shipping_zones").select("*").order("sort_order"),
    supabase.from("site_settings").select("*").eq("id", true).maybeSingle(),
  ]);
  const zones = (data ?? []) as ShippingZone[];
  const settings = settingsRow as SiteSettings | null;

  let providerId = "flat_zones";
  try {
    providerId = getShippingProvider(supabase).id;
  } catch {
    // A bad SHIPPING_PROVIDER value must not take the settings page down.
  }

  return (
    <div>
      <Link
        href="/admin/settings"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-sea-800 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Site settings
      </Link>

      <PageHeader
        title="Shipping rates"
        description="Flat rates by zone. Checkout picks the zone from the delivery address."
      />

      <p className="mb-6 rounded-lg border border-sea-200 bg-white px-4 py-3 text-sm text-sea-800">
        Indonesian orders use the two domestic zones — Java and everywhere else —
        chosen automatically from the province. Everywhere else matches on
        country code, falling back to the zone coded <code>rest</code>.
      </p>

      <Panel
        title="Where you ship from"
        description="Only used if you switch to live courier rates — a rate depends on origin as well as destination. Harmless to fill in now."
        className="mb-6"
      >
        <form action={updateShippingOrigin} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact name">
              <input name="origin_contact_name" className="input" defaultValue={settings?.origin_contact_name ?? ""} />
            </Field>
            <Field label="Phone">
              <input name="origin_phone" className="input" defaultValue={settings?.origin_phone ?? ""} />
            </Field>
          </div>
          <Field label="Address">
            <input name="origin_address" className="input" defaultValue={settings?.origin_address ?? ""} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City">
              <input name="origin_city" className="input" defaultValue={settings?.origin_city ?? ""} />
            </Field>
            <Field label="Province">
              <input name="origin_province" className="input" defaultValue={settings?.origin_province ?? ""} />
            </Field>
            <Field label="Postal code">
              <input name="origin_postal_code" className="input" defaultValue={settings?.origin_postal_code ?? ""} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Courier area code" hint="Only if your courier gives you one. Leave blank otherwise.">
              <input name="origin_area_code" className="input" defaultValue={settings?.origin_area_code ?? ""} />
            </Field>
            <Field label="Pickup note" hint="Anything the driver needs to know.">
              <input name="origin_note" className="input" defaultValue={settings?.origin_note ?? ""} />
            </Field>
          </div>
          <button type="submit" className="btn-primary py-2 text-xs">
            Save pickup address
          </button>
        </form>
      </Panel>

      <Panel
        title="Live courier prices"
        description="Check whether the connection to Biteship is working, without placing an order."
        className="mb-6"
      >
        <CourierTest providerId={providerId} />
      </Panel>

      <div className="space-y-4">
        {zones.length ? (
          zones.map((zone) => (
            <Panel key={zone.id}>
              <ZoneForm zone={zone} />
              <form action={deleteShippingZone} className="mt-3 border-t border-sea-200 pt-3">
                <input type="hidden" name="id" value={zone.id} />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 text-xs text-sea-800 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete this zone
                </button>
              </form>
            </Panel>
          ))
        ) : (
          <EmptyRow>No zones configured. Add one below.</EmptyRow>
        )}
      </div>

      <Panel title="Add a zone" className="mt-6">
        <ZoneForm />
      </Panel>
    </div>
  );
}

function ZoneForm({ zone }: { zone?: ShippingZone }) {
  return (
    <form action={saveShippingZone} className="space-y-4">
      {zone && <input type="hidden" name="id" value={zone.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Zone name">
          <input name="name" className="input" defaultValue={zone?.name ?? ""} required />
        </Field>
        <Field label="Code" hint="Short id used internally. Do not change it once orders exist.">
          <input
            name="code"
            className="input font-mono text-xs"
            defaultValue={zone?.code ?? ""}
            required
          />
        </Field>
      </div>

      <Field
        label="Countries"
        hint="Two-letter codes separated by commas, e.g. SG, MY, TH. Leave blank for the catch-all zone."
      >
        <input
          name="country_codes"
          className="input"
          defaultValue={(zone?.country_codes ?? []).join(", ")}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Rate up to threshold (Rp)">
          <input
            type="number"
            min="0"
            step="1000"
            name="base_rate_idr"
            className="input"
            defaultValue={zone?.base_rate_idr ?? 0}
          />
        </Field>
        <Field label="Weight threshold (g)">
          <input
            type="number"
            min="1"
            name="threshold_grams"
            className="input"
            defaultValue={zone?.threshold_grams ?? 1000}
          />
        </Field>
        <Field label="Rate above threshold (Rp)">
          <input
            type="number"
            min="0"
            step="1000"
            name="heavy_rate_idr"
            className="input"
            defaultValue={zone?.heavy_rate_idr ?? 0}
          />
        </Field>
        <Field label="Free shipping over (Rp)" hint="Leave blank for none.">
          <input
            type="number"
            min="0"
            step="1000"
            name="free_shipping_over_idr"
            className="input"
            defaultValue={zone?.free_shipping_over_idr ?? ""}
          />
        </Field>
      </div>

      <div className="rounded-lg border border-sea-200 bg-sea-50 p-4">
        <p className="text-sm font-medium">Partial discount (optional)</p>
        <p className="mt-1 text-xs text-sea-800">
          A step below free shipping — knock a fixed amount off for orders over
          a smaller spend. Leave blank to skip straight from full price to free.
        </p>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Discount applies over (Rp)" hint="Must be lower than the free-shipping figure above.">
            <input
              type="number"
              min="0"
              step="1000"
              name="subsidy_over_idr"
              className="input"
              defaultValue={zone?.subsidy_over_idr ?? ""}
            />
          </Field>
          <Field label="Amount off shipping (Rp)" hint="Capped at the shipping rate, so it can reach free but never discounts the coffee.">
            <input
              type="number"
              min="0"
              step="1000"
              name="subsidy_idr"
              className="input"
              defaultValue={zone?.subsidy_idr ?? 0}
            />
          </Field>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Delivery estimate">
          <input
            name="delivery_estimate"
            className="input"
            defaultValue={zone?.delivery_estimate ?? ""}
            placeholder="5–10 business days"
          />
        </Field>
        <Field label="Order">
          <input
            type="number"
            name="sort_order"
            className="input w-24"
            defaultValue={zone?.sort_order ?? 0}
          />
        </Field>
        <div className="flex items-end gap-5 pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_domestic"
              defaultChecked={zone?.is_domestic ?? false}
              className="h-4 w-4 rounded border-sea-300"
            />
            Indonesia
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={zone?.is_active ?? true}
              className="h-4 w-4 rounded border-sea-300"
            />
            Active
          </label>
        </div>
      </div>

      <button type="submit" className="btn-primary py-2 text-xs">
        {zone ? "Save zone" : "Add zone"}
      </button>
    </form>
  );
}
