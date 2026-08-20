"use client";

import { useState } from "react";
import { isValidHexColor } from "@/lib/utils";

/** The brand palette first, then the two darkest steps of the site's own ramp.
 *  These are the eight colours that look like they belong here; the hex field
 *  below is for anything else. */
const PRESETS = [
  "#ee8a7a", "#e2a290", "#dab0b0", "#a7a4b5",
  "#638c97", "#486b73", "#243c43", "#13262b",
];

/** Product card accent colour (spec §7.2). Swatches for speed, a hex field for
 *  when the operator has a brand colour in mind. */
export function ColorPicker({
  name,
  label,
  defaultValue = "#486b73",
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  hint?: string;
}) {
  const [color, setColor] = useState(defaultValue);
  const valid = isValidHexColor(color);

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={valid ? color : "#486b73"}
          onChange={(event) => setColor(event.target.value)}
          className="h-10 w-14 cursor-pointer rounded border border-sea-200 bg-white p-1"
          aria-label={`${label} colour picker`}
        />
        <input
          type="text"
          name={name}
          value={color}
          onChange={(event) => setColor(event.target.value)}
          className="input w-32 font-mono"
          maxLength={7}
        />
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setColor(preset)}
              style={{ backgroundColor: preset }}
              className="h-6 w-6 rounded-full ring-1 ring-inset ring-black/10 hover:scale-110"
              aria-label={`Use ${preset}`}
            />
          ))}
        </div>
      </div>
      {!valid && (
        <p className="mt-1.5 text-xs text-amber-700">
          Use a 6-digit hex colour, like #486b73.
        </p>
      )}
      {hint && <p className="mt-1.5 text-xs text-sea-800">{hint}</p>}
    </div>
  );
}
