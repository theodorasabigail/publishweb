import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EmptyRow, PageHeader, Panel, StatCard } from "@/components/admin/ui";
import { SubscriberExport } from "@/components/admin/subscriber-export";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Subscriber {
  id: string;
  email: string;
  source: string | null;
  created_at: string;
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
  const { data } = await supabase
    .from("newsletter_subscribers")
    .select("*")
    .order("created_at", { ascending: false });

  const subscribers = (data ?? []) as Subscriber[];

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

      <Panel title="Sending to this list" className="mt-6">
        <p className="text-sm text-sea-800">
          The shop does not send newsletters itself, on purpose — bulk email
          needs unsubscribe handling, bounce handling and sender reputation, and
          doing that badly gets your domain blocked for the receipts that
          actually matter.
        </p>
        <p className="mt-3 text-sm text-sea-800">
          Export the list above and load it into something built for it. Your
          Resend account can do broadcasts, or Buttondown and MailerLite have
          free tiers at this size. Say the word and this can post new
          subscribers to one of them automatically.
        </p>
      </Panel>
    </div>
  );
}
