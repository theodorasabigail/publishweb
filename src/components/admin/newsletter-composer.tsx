"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, Link2, RefreshCw, Send } from "lucide-react";
import {
  connectAudience,
  sendNewsletter,
  syncSubscribers,
} from "@/app/admin/_actions/newsletter";
import { Field } from "@/components/admin/ui";

type Result = { ok: boolean; message: string } | null;

/**
 * Connect, sync, and write.
 *
 * Sending is the one action here that cannot be undone — an email that has
 * left is gone — so it asks to be confirmed and states the number of people it
 * is about to reach, which is the fact that actually changes the decision.
 */
export function NewsletterComposer({
  connected,
  subscriberCount,
  unsyncedCount,
}: {
  connected: boolean;
  subscriberCount: number;
  unsyncedCount: number;
}) {
  const [result, setResult] = useState<Result>(null);
  const [confirming, setConfirming] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      setResult(await action());
      setConfirming(false);
    });
  }

  return (
    <div>
      {result && (
        <div
          className={`mb-5 flex items-start gap-2 rounded-lg p-3 text-sm ${
            result.ok ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"
          }`}
        >
          {result.ok ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {result.message}
        </div>
      )}

      {!connected ? (
        <div>
          <p className="text-sm text-sea-800">
            Your subscribers are stored here but Resend does not have them yet.
            Connecting creates a list in your Resend account called{" "}
            <strong>Publish Coffee Roasters</strong> and remembers it. Nothing
            is sent, and nobody is emailed.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(connectAudience)}
            className="btn-primary mt-4 py-2 text-xs"
          >
            <Link2 className="h-4 w-4" />
            {pending ? "Connecting…" : "Connect to Resend"}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-sea-50 p-3">
            <p className="min-w-0 flex-1 text-sm">
              {unsyncedCount > 0 ? (
                <>
                  <strong>{unsyncedCount}</strong>{" "}
                  {unsyncedCount === 1 ? "address has" : "addresses have"} not
                  reached Resend yet.
                </>
              ) : (
                "All subscribers are synced to Resend."
              )}
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(syncSubscribers)}
              className="btn-secondary py-2 text-xs"
            >
              <RefreshCw className="h-4 w-4" />
              {pending ? "Syncing…" : "Sync now"}
            </button>
          </div>

          <div className="space-y-4">
            <Field label="Subject">
              <input
                className="input"
                value={subject}
                onChange={(event) => {
                  setSubject(event.target.value);
                  setConfirming(false);
                }}
                placeholder="This week: Kamojang Anaerobic Washed"
              />
            </Field>

            <Field
              label="Message"
              hint="Markdown works: **bold**, [links](https://…), and - for bullets."
            >
              <textarea
                className="input min-h-56 font-mono text-sm"
                value={body}
                onChange={(event) => {
                  setBody(event.target.value);
                  setConfirming(false);
                }}
                placeholder={"Hello,\n\nWe roasted something new this week…"}
              />
            </Field>

            {confirming ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-900">
                  Send &ldquo;{subject}&rdquo; to {subscriberCount}{" "}
                  {subscriberCount === 1 ? "person" : "people"}?
                </p>
                <p className="mt-1.5 text-sm text-amber-900">
                  This cannot be undone or recalled. An unsubscribe link is
                  added automatically.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const formData = new FormData();
                      formData.set("subject", subject);
                      formData.set("body", body);
                      run(() => sendNewsletter(formData));
                    }}
                    className="btn-primary py-2 text-xs"
                  >
                    <Send className="h-4 w-4" />
                    {pending ? "Sending…" : "Yes, send it"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="btn-secondary py-2 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={pending || !subject || !body}
                onClick={() => setConfirming(true)}
                className="btn-primary py-2 text-xs disabled:opacity-40"
              >
                <Send className="h-4 w-4" /> Send to {subscriberCount}{" "}
                {subscriberCount === 1 ? "subscriber" : "subscribers"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
