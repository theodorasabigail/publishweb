"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { updateVariantField, type QuickResult } from "@/app/admin/_actions/quick-edit";
import { cn } from "@/lib/utils";

/**
 * Fields that save themselves.
 *
 * Shared by the products sheet and the edit panel on the shop itself, so a
 * price typed in either place behaves the same: saved when you leave the
 * field or press Enter, Escape to undo, and a spinner, tick or the reason it
 * failed shown right where you typed.
 */

type Status = "idle" | "saving" | "saved" | "error";

/** A cell that saves itself on blur or Enter, and says how that went. */
export function TextCell({
  value: initial,
  onSave,
  col,
  numeric = false,
  multiline = false,
  placeholder,
  className,
}: {
  value: string;
  onSave: (value: string) => Promise<QuickResult>;
  col: string;
  numeric?: boolean;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [, startTransition] = useTransition();

  function commit() {
    const next = numeric ? value.replace(/[^\d-]/g, "") : value;
    if (next === saved) {
      setStatus((current) => (current === "error" ? "idle" : current));
      setError(null);
      setValue(saved);
      return;
    }
    setStatus("saving");
    startTransition(async () => {
      const result = await onSave(next).catch(() => ({
        ok: false as const,
        error: "Could not reach the server.",
      }));
      if (result.ok) {
        setSaved(next);
        setValue(next);
        setStatus("saved");
        setError(null);
      } else {
        setStatus("error");
        setError(result.error);
      }
    });
  }

  // Numbers read as 110.000 when you are not typing in them; typing shows
  // the bare digits again.
  const shown =
    numeric && !focused && /^-?\d+$/.test(value) ? Number(value).toLocaleString("id-ID") : value;

  const shared = {
    "data-col": col,
    value: shown,
    placeholder,
    onFocus: () => setFocused(true),
    onBlur: () => {
      setFocused(false);
      commit();
    },
    "aria-invalid": status === "error",
    className: cn(
      "w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none",
      "hover:border-sea-200 focus:border-sea-500 focus:bg-white",
      status === "error" && "border-red-400 bg-red-50",
      className,
    ),
  };

  return (
    <div className="relative">
      {multiline ? (
        <textarea
          {...shared}
          rows={focused ? 6 : 2}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setValue(saved);
              (event.target as HTMLTextAreaElement).blur();
            }
          }}
          className={cn(shared.className, "resize-y leading-snug")}
        />
      ) : (
        <input
          {...shared}
          inputMode={numeric ? "numeric" : undefined}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setValue(saved);
              (event.target as HTMLInputElement).blur();
            } else if (event.key === "Enter") {
              event.preventDefault();
              moveDown(event.currentTarget, col);
            }
          }}
        />
      )}
      <StatusMark status={status} error={error} />
      {error && <p className="px-1.5 text-[11px] leading-tight text-red-700">{error}</p>}
    </div>
  );
}

/** Enter goes to the same column one row down, like a spreadsheet. */
function moveDown(from: HTMLElement, col: string) {
  const cells = Array.from(document.querySelectorAll<HTMLElement>(`[data-col="${col}"]`));
  const next = cells[cells.indexOf(from) + 1];
  if (next) next.focus();
  else from.blur();
}

export function StockCell({
  variantId,
  stock,
  reserved,
  onSaved,
}: {
  variantId: string;
  stock: number;
  reserved: number;
  onSaved?: () => void;
}) {
  const [current, setCurrent] = useState(stock);
  const owed = Math.max(0, reserved - current);
  const free = Math.max(0, current - reserved);

  return (
    <div className="w-24">
      <TextCell
        col="stock"
        value={String(stock)}
        numeric
        className={cn("text-right", current < 0 && "text-amber-700")}
        onSave={async (value) => {
          const result = await updateVariantField(variantId, "stock", value);
          if (result.ok) {
            setCurrent(Number(value));
            onSaved?.();
          }
          return result;
        }}
      />
      <p
        className={cn(
          "px-1.5 text-right text-[11px] leading-tight",
          owed > 0 ? "font-medium text-amber-700" : "text-sea-800",
        )}
        title={
          owed > 0
            ? "Sold before it was roasted. Add the roast to the stock number and it balances."
            : reserved > 0
              ? "Held by orders that are not paid yet."
              : undefined
        }
      >
        {owed > 0 ? `${owed} to roast` : reserved > 0 ? `${reserved} held · ${free} free` : null}
      </p>
    </div>
  );
}

/** A switch that saves the moment it is flipped, and flips back if it fails. */
export function ToggleCell({
  value: initial,
  onSave,
  label,
}: {
  value: boolean;
  onSave: (value: boolean) => Promise<QuickResult>;
  label: string;
}) {
  const [on, setOn] = useState(initial);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="relative flex items-center gap-1.5 px-1.5 py-1">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => {
          const next = !on;
          setOn(next);
          setStatus("saving");
          startTransition(async () => {
            const result = await onSave(next).catch(() => ({
              ok: false as const,
              error: "Could not reach the server.",
            }));
            if (result.ok) {
              setStatus("saved");
              setError(null);
            } else {
              setOn(!next);
              setStatus("error");
              setError(result.error);
            }
          });
        }}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          on ? "bg-emerald-600" : "bg-sea-200",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
            on ? "left-[18px]" : "left-0.5",
          )}
        />
      </button>
      <span className="text-[11px] text-sea-800">{on ? "Yes" : "No"}</span>
      {status === "saving" && <Loader2 className="h-3 w-3 animate-spin text-sea-800" />}
      {error && (
        <span className="text-red-700" title={error}>
          <TriangleAlert className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}

function StatusMark({ status, error }: { status: Status; error: string | null }) {
  if (status === "saving") {
    return (
      <Loader2 className="pointer-events-none absolute -right-1 top-1.5 h-3 w-3 animate-spin text-sea-800" />
    );
  }
  if (status === "saved") {
    return (
      <Check
        className="pointer-events-none absolute -right-1 top-1.5 h-3 w-3 text-emerald-700"
        aria-label="Saved"
      />
    );
  }
  if (status === "error") {
    return (
      <span
        className="pointer-events-none absolute -right-1 top-1.5 text-red-700"
        title={error ?? undefined}
      >
        <TriangleAlert className="h-3 w-3" />
      </span>
    );
  }
  return null;
}
