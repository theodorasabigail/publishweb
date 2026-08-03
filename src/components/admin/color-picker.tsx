"use client";

import { useState } from "react";
import { isValidHexColor } from "@/lib/utils";

const PRESETS = [
  "#5d4033", "#714c39", "#8c6144", "#a3784f",
  "#b69169", "#cdb493", "#4e372d", "#2b1c16",
];

/** Product card accent colour (spec §7.2). Swatches for speed, a hex field for
 *  when the operator has a brand colour in mind. */
export function ColorPicker({
  name,
  label,
  defaultValue = "#8c6144",
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
          value={valid ? color : "#8c6144"}
          onChange={(event) => setColor(event.target.value)}
          className="h-10 w-14 cursor-pointer rounded border border-bark-200 bg-white p-1"
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
          Use a 6-digit hex colour, like #8c6144.
        </p>
      )}
      {hint && <p className="mt-1.5 text-xs text-bark-500">{hint}</p>}
    </div>
  );
}
