"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { updateHomepageCategories } from "@/app/admin/_actions/settings";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Presentation control (spec §7.2): which categories appear on the homepage,
 * and in what order. Tick to include, arrows to order, one save.
 */
export function HomepageCategoryPicker({
  categories,
  selectedIds,
}: {
  categories: Category[];
  selectedIds: string[];
}) {
  const [selected, setSelected] = useState<string[]>(
    selectedIds.filter((id) => categories.some((category) => category.id === id)),
  );
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const unselected = categories.filter((category) => !selected.includes(category.id));

  function toggle(id: string) {
    setSaved(false);
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= selected.length) return;
    const next = [...selected];
    [next[index], next[target]] = [next[target], next[index]];
    setSelected(next);
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      await updateHomepageCategories(selected);
      setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="label">On the homepage, in this order</p>
        {selected.length ? (
          <ul className="divide-y divide-sea-200 rounded-lg border border-sea-200">
            {selected.map((id, index) => {
              const category = categories.find((item) => item.id === id);
              if (!category) return null;

              return (
                <li key={id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-5 text-xs text-sea-800">{index + 1}</span>
                  <span className="flex-1 text-sm">{category.name}</span>
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="rounded p-1 text-sea-800 hover:bg-sea-100 disabled:opacity-30"
                    aria-label={`Move ${category.name} up`}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === selected.length - 1}
                    className="rounded p-1 text-sea-800 hover:bg-sea-100 disabled:opacity-30"
                    aria-label={`Move ${category.name} down`}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className="rounded px-2 py-1 text-xs text-sea-800 hover:bg-sea-100"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-sea-300 px-3 py-6 text-center text-sm text-sea-800">
            None chosen — the homepage will fall back to every category marked
            &ldquo;available for the homepage&rdquo;.
          </p>
        )}
      </div>

      {unselected.length > 0 && (
        <div>
          <p className="label">Add one</p>
          <div className="flex flex-wrap gap-2">
            {unselected.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => toggle(category.id)}
                className="badge border border-sea-200 bg-white text-sea-700 hover:border-sea-400"
              >
                + {category.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className={cn("btn-primary py-2 text-xs")}
        >
          {pending ? "Saving…" : "Save homepage order"}
        </button>
        {saved && <span className="text-xs text-emerald-700">Saved.</span>}
      </div>
    </div>
  );
}
