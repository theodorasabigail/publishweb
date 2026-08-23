"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { FLAVOUR_LEVELS, FLAVOUR_SWATCH_RING } from "@/lib/flavour";
import { cn } from "@/lib/utils";

/**
 * Which colour a coffee is on the flavour scale.
 *
 * Swatches rather than a dropdown, because the scale is a colour — reading
 * "4" in a list and having to remember what 4 looks like is the wrong way
 * round when the answer is printed on the bag in front of you.
 */
export function FlavourPicker({
  defaultValue,
  name = "flavour_level",
}: {
  defaultValue?: number | null;
  name?: string;
}) {
  const [level, setLevel] = useState<number>(defaultValue ?? 0);
  const current = FLAVOUR_LEVELS.find((entry) => entry.level === level);

  return (
    <div>
      <span className="label">Flavour colour</span>
      <input type="hidden" name={name} value={level} />

      <div className="flex flex-wrap gap-2">
        {FLAVOUR_LEVELS.map((entry) => {
          const selected = entry.level === level;
          return (
            <button
              key={entry.level}
              type="button"
              // Clicking the selected one clears it, so "not decided yet" stays
              // reachable without a separate control.
              onClick={() => setLevel(selected ? 0 : entry.level)}
              aria-pressed={selected}
              title={`${entry.label} — ${entry.description}`}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-lg transition-transform hover:scale-105",
                selected && "ring-2 ring-sea-900 ring-offset-2",
              )}
              style={{ backgroundColor: entry.hex, border: FLAVOUR_SWATCH_RING }}
            >
              {selected ? (
                <Check className="h-4 w-4 text-ink" />
              ) : (
                <span className="text-sm font-medium text-ink/70">{entry.level}</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-sea-800">
        {current ? (
          <>
            <strong>{current.label}</strong> — {current.description}
          </>
        ) : (
          "Not set — this coffee shows in plain grey until you pick a level. It is the only colour a coffee has."
        )}
      </p>
    </div>
  );
}
