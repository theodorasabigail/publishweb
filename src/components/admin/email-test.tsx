"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { testEmailDelivery } from "@/app/admin/_actions/settings";

type Result = { ok: boolean; summary: string; advice?: string };

/**
 * "Are my customers actually getting their receipts?"
 *
 * Nothing else can answer that. Order emails swallow their own failures on
 * purpose — a mail outage must never break a paid order — which means a
 * silently broken configuration looks exactly like a working one.
 */
export function EmailTest({ configured }: { configured: boolean }) {
  const [to, setTo] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  function run(formData: FormData) {
    startTransition(async () => setResult(await testEmailDelivery(formData)));
  }

  return (
    <div>
      {!configured && (
        <p className="mb-4 rounded-lg bg-bark-50 p-3 text-sm text-bark-700">
          No email service is connected, so no receipts are being sent. Everything
          else about the shop works normally. Follow the steps above to switch it
          on.
        </p>
      )}

      <form action={run} className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <label className="label" htmlFor="to">
            Send a test email to
          </label>
          <input
            id="to"
            name="to"
            type="email"
            className="input"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <button type="submit" disabled={pending || !to} className="btn-primary py-2 text-xs">
          {pending ? "Sending…" : "Send test email"}
        </button>
      </form>

      <p className="mt-2 text-xs text-bark-600">
        Sends one real email. No customer is contacted.
      </p>

      {result && (
        <div
          className={`mt-5 rounded-lg border p-4 ${
            result.ok ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"
          }`}
        >
          <p className="flex items-start gap-2 text-sm font-medium">
            {result.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            )}
            {result.summary}
          </p>
          {result.advice && (
            <p className="mt-2 pl-6 text-sm text-bark-700">{result.advice}</p>
          )}
        </div>
      )}
    </div>
  );
}
