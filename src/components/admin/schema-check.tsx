import { AlertTriangle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * "Is the database up to date with this version of the site?"
 *
 * Nothing else answers it, and getting it wrong is the single most confusing
 * failure this project has. The site deploys the moment code is pushed; the
 * SQL is run by hand afterwards, or not. In the gap, features exist in the
 * interface and not in the database, and every attempt to use one throws a
 * Postgres error that React deliberately hides in production — the operator
 * sees "Minified React error #441" or a blank server-error page, with nothing
 * connecting it to a migration they have not run.
 *
 * So this asks the database directly, cheaply, on every admin page: does each
 * of these exist? One row, one column — it either succeeds or comes back
 * 42703 (no such column) or 42P01 (no such table).
 *
 * Deliberately a GET rather than a `head` count. A HEAD request against a
 * table that does not exist comes back as an empty result rather than an
 * error, so the missing-table case — the one that matters most — went
 * undetected. Fetching a single row costs nothing and cannot be ambiguous.
 *
 * The checks are the *newest* thing each migration added, so one probe stands
 * in for the whole migration.
 */

interface Probe {
  label: string;
  migration: string;
  run: (supabase: ReturnType<typeof createAdminClient>) => Promise<boolean>;
}

const PROBES: Probe[] = [
  {
    label: "Pack sizes you can type yourself",
    migration: "0010",
    run: async (supabase) => {
      // The check constraint 0010 adds. Its absence cannot be probed directly,
      // so this stands in for the whole migration via the column it needs.
      const { error } = await supabase
        .from("product_variants")
        .select("weight_grams")
        .limit(1);
      return !error;
    },
  },
  {
    label: "Order receipt emails",
    migration: "0009",
    run: async (supabase) => {
      const { error } = await supabase
        .from("orders")
        .select("confirmation_email_sent_at")
        .limit(1);
      return !error;
    },
  },
  {
    label: "Editable coming-soon page",
    migration: "0012",
    run: async (supabase) => {
      const { error } = await supabase
        .from("site_settings")
        .select("coming_soon_title")
        .limit(1);
      return !error;
    },
  },
  {
    label: "Flavour colours",
    migration: "0013",
    run: async (supabase) => {
      const { error } = await supabase
        .from("products")
        .select("flavour_level")
        .limit(1);
      return !error;
    },
  },
  {
    label: "Page blocks",
    migration: "0014",
    run: async (supabase) => {
      const { error } = await supabase
        .from("page_blocks")
        .select("id")
        .limit(1);
      return !error;
    },
  },

  // 0019 onward — the whole order-workflow chapter. Each probe picks the
  // youngest column its migration added, so one probe stands in for one paste.
  {
    label: "Orders that hold their coffee",
    migration: "0019",
    run: async (supabase) => {
      const { error } = await supabase
        .from("product_variants")
        .select("reserved")
        .limit(1);
      return !error;
    },
  },
  {
    label: "When an order actually shipped",
    migration: "0020",
    run: async (supabase) => {
      const { error } = await supabase.from("orders").select("shipped_at").limit(1);
      return !error;
    },
  },
  {
    label: "Voiding a mis-typed order",
    migration: "0021",
    run: async (supabase) => {
      const { error } = await supabase.from("orders").select("voided_at").limit(1);
      return !error;
    },
  },
  {
    label: "Points for people without an account",
    migration: "0023",
    run: async (supabase) => {
      const { error } = await supabase.from("pending_loyalty").select("id").limit(1);
      return !error;
    },
  },
  {
    label: "Indonesian address fields (kelurahan, kecamatan, area id)",
    migration: "0026",
    run: async (supabase) => {
      const { error } = await supabase.from("addresses").select("area_id").limit(1);
      return !error;
    },
  },
  {
    label: "Scheduled orders (POs)",
    migration: "0029",
    run: async (supabase) => {
      const { error } = await supabase.from("orders").select("ship_after").limit(1);
      return !error;
    },
  },
  {
    label: "Coffees in more than one category",
    migration: "0031",
    run: async (supabase) => {
      const { error } = await supabase
        .from("product_categories")
        .select("product_id")
        .limit(1);
      return !error;
    },
  },
  {
    label: "Your own list of payment methods",
    migration: "0032",
    run: async (supabase) => {
      const { error } = await supabase
        .from("site_settings")
        .select("payment_methods")
        .limit(1);
      return !error;
    },
  },
];

export async function SchemaCheck() {
  if (!isSupabaseConfigured()) return null;

  let missing: Probe[] = [];
  try {
    const supabase = createAdminClient();
    const results = await Promise.all(
      PROBES.map(async (probe) => ({ probe, ok: await probe.run(supabase) })),
    );
    missing = results.filter((result) => !result.ok).map((result) => result.probe);
  } catch {
    // A check that cannot run must not be the thing that takes the dashboard
    // down — that would be worse than the problem it exists to report.
    return null;
  }

  if (!missing.length) return null;

  return (
    <div className="mb-6 rounded-xl border border-amber-400 bg-amber-50 p-5">
      <p className="flex items-center gap-2 font-medium text-amber-900">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Your database needs updating
      </p>

      <p className="mt-2 text-sm text-amber-900">
        {missing.length === 1 ? "One part" : `${missing.length} parts`} of the
        site {missing.length === 1 ? "is" : "are"} installed here but missing
        from your database. Anything that uses{" "}
        {missing.length === 1 ? "it" : "them"} will fail with a server error
        until you run the setup file.
      </p>

      <ul className="mt-3 space-y-1 text-sm text-amber-900">
        {missing.map((probe) => (
          <li key={probe.migration}>
            &middot; {probe.label}{" "}
            <span className="text-amber-800">(step {probe.migration})</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm font-medium text-amber-900">To fix it, once:</p>
      <ol className="mt-1 space-y-1 text-sm text-amber-900">
        <li>1. Open Supabase → SQL Editor</li>
        <li>
          2. Paste the whole of <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">supabase/setup.sql</code>{" "}
          from the project
        </li>
        <li>3. Run it, then reload this page</li>
      </ol>
      <p className="mt-3 text-xs text-amber-800">
        Running it again is safe, by construction: that file contains no
        coffees, prices or writing at all, so there is nothing in it that could
        overwrite what you have set up.
      </p>
    </div>
  );
}
