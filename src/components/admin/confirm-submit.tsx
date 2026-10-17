"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * A delete button that asks first.
 *
 * Sits inside the form it submits. The first click only asks — "Delete this
 * coffee for good?" with a red Yes and a Cancel — and nothing is sent until
 * the second, so a slip of the finger on a phone never removes anything.
 * Escape or Cancel backs out.
 */
export function ConfirmSubmit({
  children,
  question,
  confirmLabel,
  className,
}: {
  /** The button as it normally looks. */
  children: React.ReactNode;
  /** What is about to happen, in plain words. */
  question: React.ReactNode;
  /** The button that actually deletes, e.g. "Yes, delete it". */
  confirmLabel: string;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  const { pending } = useFormStatus();
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!asking) return;
    // Focus lands on Cancel, so Enter right after the first click backs out
    // rather than confirming.
    cancel.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setAsking(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asking]);

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={className}>
        {children}
      </button>
    );
  }

  return (
    <span
      role="alertdialog"
      aria-live="assertive"
      className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900"
    >
      <span>{question}</span>
      <button
        type="submit"
        disabled={pending}
        className={cn("btn-danger py-1.5 text-xs", pending && "opacity-60")}
      >
        {pending ? "Deleting…" : confirmLabel}
      </button>
      <button
        ref={cancel}
        type="button"
        onClick={() => setAsking(false)}
        disabled={pending}
        className="rounded px-2 py-1 text-red-900 underline hover:bg-red-100"
      >
        Cancel
      </button>
    </span>
  );
}
