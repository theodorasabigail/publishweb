import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EmptyRow, PageHeader, Panel, StatCard } from "@/components/admin/ui";
import { NewsletterComposer } from "@/components/admin/newsletter-composer";
import { SubscriberExport } from "@/components/admin/subscriber-export";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Subscriber {
  id: string;
  email: string;
  source: string | null;
  created_at: string;
  synced_at: string | null;
}

/**
 * The mailing list.
 *
 * The signup form has been collecting addresses since launch and there was
 * nowhere to see them — which meant the shop was quietly accumulating an asset
 * its owner could not use, and could not have known existed.
 */
export default async function AdminSubscribersPage() {
  const supabase = createAdminClient();
  const [{ data }, { data: settingsRow }] = await Promise.all([
    supabase
      .from("newsletter_subscribers")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("site_settings").select("resend_audience_id").eq("id", true).maybeSingle(),
  ]);

  const subscribers = (data ?? []) as Subscriber[];
  const audienceId = (settingsRow as { resend_audience_id: string | null } | null)
    ?.resend_audience_id;
  const unsynced = subscribers.filter((row) => !row.synced_at).length;

  // react-hooks/purity assumes a client component that may re-render. This is
  // an async Server Component marked force-dynamic: it runs once per request,
  // and reading the clock is exactly what "the last 30 days" means.
  // eslint-disable-next-line react-hooks/purity
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = subscribers.filter(
    (row) => new Date(row.created_at).getTime() >= thirtyDaysAgo,
  ).length;

  return (
    <div>
      <Link
        href="/admin/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-sea-800 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Customers
      </Link>

      <PageHeader
        title="Mailing list"
        description="People who asked to hear from you, from the signup form on the site."
        action={<SubscriberExport subscribers={subscribers} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Subscribers" value={String(subscribers.length)} />
        <StatCard label="Joined in the last 30 days" value={String(recent)} />
      </div>

      <Panel title="Everyone on the list">
        {subscribers.length ? (
          <div className="divide-y divide-sea-200">
            {subscribers.map((row) => (
              <div key={row.id} className="flex flex-wrap items-baseline gap-x-4 py-2.5">
                <span className="min-w-0 flex-1 truncate">{row.email}</span>
                {row.source && (
                  <span className="badge bg-sea-100 text-sea-800">{row.source}</span>
                )}
                <span className="text-sm text-sea-800">
                  {formatDate(row.created_at)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyRow>
            Nobody yet. The signup form is on the footer of every page and on the
            coming-soon page.
          </EmptyRow>
        )}
      </Panel>

      <Panel
        title="Write to the list"
        description="Sent through Resend, the same account your order receipts use."
        className="mt-6"
      >
        <NewsletterComposer
          connected={Boolean(audienceId)}
          subscriberCount={subscribers.length}
          unsyncedCount={unsynced}
        />
        <p className="mt-6 border-t border-sea-200 pt-4 text-xs text-sea-800">
          Resend does the sending, which means it also handles the unsubscribe
          link, bounces and anyone who has opted out — the parts that, done
          badly, get your domain blocked for the order receipts that actually
          matter. Their free plan covers 3,000 emails a month and 100 a day, so
          one send to a few hundred people is comfortably inside it.
        </p>
      </Panel>
    </div>
  );
}
