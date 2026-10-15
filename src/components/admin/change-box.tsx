"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { applyProductChanges, readProductChanges } from "@/app/admin/_actions/product-changes";
import type { ProductChange } from "@/lib/product-changes";

/**
 * "Tell it what changed."
 *
 * One box above the sheet for the changes that are quicker to say than to
 * click: after a roast, after a price rise, when a coffee runs out. What it
 * understood comes back as a list of sentences with a tick each, and only the
 * ticked ones are applied.
 */
export function ChangeBox() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [proposal, setProposal] = useState<{
    changes: ProductChange[];
    picked: boolean[];
    notUnderstood: string[];
    source: "ai" | "basic";
    notice?: string;
  } | null>(null);
  const [results, setResults] = useState<{ summary: string; ok: boolean; error?: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, startReading] = useTransition();
  const [applying, startApplying] = useTransition();

  function read() {
    setError(null);
    setResults(null);
    startReading(async () => {
      const result = await readProductChanges(text).catch(() => null);
      if (!result) {
        setError("Could not reach the server. Try again.");
        return;
      }
      if (!result.ok) {
        setError(result.error ?? "Could not read that.");
        return;
      }
      setProposal({
        changes: result.changes,
        picked: result.changes.map(() => true),
        notUnderstood: result.notUnderstood,
        source: result.source,
        notice: result.notice,
      });
    });
  }

  function apply() {
    if (!proposal) return;
    const chosen = proposal.changes.filter((_, index) => proposal.picked[index]);
    startApplying(async () => {
      const outcome = await applyProductChanges(chosen).catch(() => null);
      if (!outcome) {
        setError("Could not reach the server. Nothing may have changed — check the sheet.");
        return;
      }
      setResults(outcome);
      setProposal(null);
      if (outcome.every((row) => row.ok)) setText("");
      router.refresh();
    });
  }

  const pickedCount = proposal?.picked.filter(Boolean).length ?? 0;

  return (
    <div className="mb-5 rounded-xl border border-sea-200 bg-white p-4">
      <label htmlFor="change-box" className="mb-1 flex items-center gap-1.5 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-sea-800" /> Tell it what changed
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <textarea
          id="change-box"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) read();
          }}
          rows={2}
          placeholder="Gayo 200g stock 12, Kintamani sold out, 1kg Gayo now 500rb, new coffee Toraja Sapan 250g 140rb"
          className="input flex-1 text-sm"
        />
        <button
          type="button"
          onClick={read}
          disabled={reading || !text.trim()}
          className="btn-secondary shrink-0 py-2 text-sm"
        >
          {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {reading ? "Reading…" : "Check changes"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}

      {proposal && (
        <div className="mt-3 rounded-lg border border-sea-200 bg-sea-50 p-3">
          {proposal.notice && <p className="mb-2 text-xs text-amber-900">{proposal.notice}</p>}
          {proposal.changes.length ? (
            <>
              <p className="mb-2 text-xs text-sea-800">
                {proposal.source === "ai" ? "Read by AI." : "Matched by coffee name."} Untick
                anything you did not mean, then apply.
              </p>
              <ul className="space-y-1">
                {proposal.changes.map((change, index) => (
                  <li key={index}>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={proposal.picked[index]}
                        onChange={() =>
                          setProposal({
                            ...proposal,
                            picked: proposal.picked.map((on, i) => (i === index ? !on : on)),
                          })
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-sea-400"
                      />
                      {change.summary}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm">No changes found in that.</p>
          )}
          {proposal.notUnderstood.length > 0 && (
            <p className="mt-2 text-xs text-amber-900">
              <TriangleAlert className="mr-1 inline h-3 w-3" />
              Not understood: {proposal.notUnderstood.map((line) => `“${line}”`).join(", ")}
            </p>
          )}
          <div className="mt-3 flex items-center justify-end gap-3">
            <button type="button" onClick={() => setProposal(null)} className="text-sm text-sea-800 hover:underline">
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={applying || pickedCount === 0}
              className="btn-primary py-2 text-sm"
            >
              {applying ? "Applying…" : `Apply ${pickedCount} ${pickedCount === 1 ? "change" : "changes"}`}
            </button>
          </div>
        </div>
      )}

      {results && (
        <ul className="mt-3 space-y-0.5 text-xs">
          {results.map((row, index) => (
            <li key={index} className={row.ok ? "text-emerald-700" : "text-red-700"}>
              {row.ok ? <Check className="mr-1 inline h-3 w-3" /> : <TriangleAlert className="mr-1 inline h-3 w-3" />}
              {row.summary}
              {row.error && ` — ${row.error}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
