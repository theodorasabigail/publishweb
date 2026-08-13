import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { EmailTest } from "@/components/admin/email-test";
import { PageHeader, Panel } from "@/components/admin/ui";
import { getEmailProvider } from "@/lib/email";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Setting up transactional email, for someone who has never done it.
 *
 * The instructions live on the page rather than in a document, because the
 * person doing this is in the dashboard, not in a repository. The three
 * indicators below are read from the environment at request time, so they
 * answer "did that step actually take?" rather than describing what should
 * have happened.
 */
export default async function AdminEmailPage() {
  const provider = getEmailProvider();
  const configured = provider.id !== "none";
  const from = env.optional("EMAIL_FROM");
  const hasKey = Boolean(env.optional("RESEND_API_KEY"));

  const checks = [
    {
      done: hasKey,
      label: "RESEND_API_KEY is set",
      detail: hasKey
        ? "The site has a key from Resend."
        : "Not set. Copy your key from Resend → API Keys into Vercel.",
    },
    {
      done: Boolean(from),
      label: "EMAIL_FROM is set",
      detail: from
        ? `Emails will be sent from ${from}.`
        : "Not set. This is the address customers see, e.g. Publish Coffee <hello@publish-coffee.com>.",
    },
    {
      done: configured,
      label: "Emails are switched on",
      detail: configured
        ? "Order confirmations and shipping notifications are being sent."
        : "Nothing is being sent yet. Both settings above are needed, then a redeploy.",
    },
  ];

  return (
    <div>
      <Link
        href="/admin/settings"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to settings
      </Link>

      <PageHeader
        title="Emails"
        description="Receipts when an order is paid, and a tracking number when it ships."
      />

      <Panel title="Where things stand" className="mb-6">
        <ul className="space-y-3">
          {checks.map((check) => (
            <li key={check.label} className="flex items-start gap-2.5">
              {check.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-bark-300" />
              )}
              <div>
                <p className="text-sm font-medium">{check.label}</p>
                <p className="text-sm text-bark-600">{check.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="How to switch emails on" className="mb-6">
        <ol className="space-y-4 text-sm text-bark-700">
          <li>
            <strong className="text-bark-900">1. Make a Resend account.</strong>{" "}
            Go to <span className="font-mono text-xs">resend.com</span> and sign
            up. The free plan covers far more email than this shop will send.
          </li>
          <li>
            <strong className="text-bark-900">2. Verify your domain.</strong> In
            Resend, go to <em>Domains</em> and add{" "}
            <span className="font-mono text-xs">publish-coffee.com</span>. It
            gives you a handful of DNS records to add wherever the domain is
            managed. This is the slow part — it can take anywhere from minutes
            to a few hours to go green, and nothing sends properly until it
            does. Everything else here takes five minutes.
          </li>
          <li>
            <strong className="text-bark-900">3. Create an API key.</strong>{" "}
            Resend → <em>API Keys</em> → create one. It is shown once. It is a
            password: it goes into Vercel and nowhere else.
          </li>
          <li>
            <strong className="text-bark-900">
              4. Add two settings in Vercel.
            </strong>{" "}
            Settings → Environment Variables, the same place the Supabase keys
            already live:
            <div className="mt-2 rounded-lg bg-bark-50 p-3 font-mono text-xs leading-relaxed">
              RESEND_API_KEY = re_...
              <br />
              EMAIL_FROM = Publish Coffee &lt;hello@publish-coffee.com&gt;
            </div>
          </li>
          <li>
            <strong className="text-bark-900">5. Redeploy.</strong> Nothing
            changes until you do — this catches everyone at least once.
          </li>
          <li>
            <strong className="text-bark-900">6. Test it below.</strong>
          </li>
        </ol>
      </Panel>

      <Panel
        title="Test the connection"
        description="Sends one real email so you can see it arrive."
        className="mb-6"
      >
        <EmailTest configured={configured} />
      </Panel>

      <Panel title="What gets sent">
        <ul className="space-y-3 text-sm text-bark-700">
          <li>
            <strong className="text-bark-900">Order confirmed.</strong> Sent once,
            the moment a payment is confirmed — whether that is Xendit, a bank
            transfer you matched by hand, or you marking the order paid
            yourself. Lists what they bought, what they paid, and any loyalty
            points earned.
          </li>
          <li>
            <strong className="text-bark-900">On its way.</strong> Sent when you
            save a tracking number on an order. Correcting a number you typed
            wrong sends a fresh one; saving the same number again sends nothing.
          </li>
          <li className="text-bark-600">
            Counter sales in the POS never send email — there is no address to
            send to and nobody waiting for one.
          </li>
        </ul>
        <p className="mt-4 rounded-lg bg-bark-50 p-3 text-sm text-bark-700">
          If email is ever broken or switched off, orders still go through
          exactly as normal. A failed email is recorded and ignored; it can
          never undo a payment.
        </p>
      </Panel>
    </div>
  );
}
