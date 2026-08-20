import { EmptyRow, Field, PageHeader, Panel } from "@/components/admin/ui";
import { RoastingStatusBadge } from "@/components/status-badge";
import { updateRoastingRequest } from "@/app/admin/_actions/roasting";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROASTING_STATUSES, type RoastingRequest } from "@/lib/types";
import { formatDateTime, formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminRoastingPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("roasting_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const requests = (data ?? []) as RoastingRequest[];
  const open = requests.filter((request) => ["new", "quoted"].includes(request.status));
  const closed = requests.filter((request) => !["new", "quoted"].includes(request.status));

  return (
    <div>
      <PageHeader
        title="Roasting requests"
        description="Custom-quote jobs from the jasa roasting form."
      />

      {open.length ? (
        <div className="space-y-4">
          {open.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      ) : (
        <EmptyRow>Nothing waiting on a quote.</EmptyRow>
      )}

      {closed.length > 0 && (
        <>
          <h2 className="mb-4 mt-10 text-sm font-medium uppercase tracking-wider text-sea-800">
            Closed
          </h2>
          <div className="space-y-4">
            {closed.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RequestCard({ request }: { request: RoastingRequest }) {
  const whatsapp = request.contact_phone.replace(/[^0-9]/g, "");

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {request.contact_name}{" "}
            <span className="text-sm font-normal text-sea-800">
              · {request.human_ref}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-sea-800">
            {formatDateTime(request.created_at)}
          </p>
        </div>
        <RoastingStatusBadge status={request.status} />
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Green beans" value={request.green_bean_origin} />
        <Detail label="Quantity" value={`${request.quantity_kg} kg`} />
        <Detail label="Roast level" value={request.desired_roast_level ?? "—"} />
        <Detail
          label="Contact"
          value={
            <>
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noreferrer noopener"
                className="underline"
              >
                {request.contact_phone}
              </a>
              {request.email && (
                <>
                  <br />
                  <a href={`mailto:${request.email}`} className="underline">
                    {request.email}
                  </a>
                </>
              )}
            </>
          }
        />
      </dl>

      {request.notes && (
        <p className="mt-4 rounded-lg bg-sea-50 p-3 text-sm text-sea-700">
          {request.notes}
        </p>
      )}

      <form
        action={updateRoastingRequest}
        className="mt-5 grid gap-4 border-t border-sea-200 pt-5 sm:grid-cols-[160px_180px_1fr_auto] sm:items-end"
      >
        <input type="hidden" name="id" value={request.id} />

        <Field label="Status">
          <select name="status" className="input capitalize" defaultValue={request.status}>
            {ROASTING_STATUSES.map((status) => (
              <option key={status} value={status} className="capitalize">
                {status}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Quote (Rp)">
          <input
            type="number"
            min="0"
            step="1000"
            name="quoted_price_idr"
            className="input"
            defaultValue={request.quoted_price_idr ?? ""}
            placeholder="0"
          />
        </Field>

        <Field label="Internal note">
          <input
            name="admin_note"
            className="input"
            defaultValue={request.admin_note ?? ""}
            placeholder="Sample roasted 12 Aug, waiting on reply"
          />
        </Field>

        <button type="submit" className="btn-primary py-2 text-xs">
          Save
        </button>
      </form>

      {request.quoted_price_idr && (
        <p className="mt-3 text-xs text-sea-800">
          Quoted at {formatIDR(request.quoted_price_idr)}.
        </p>
      )}
    </Panel>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-sea-800">{label}</dt>
      <dd className="mt-0.5 text-sea-800">{value}</dd>
    </div>
  );
}
