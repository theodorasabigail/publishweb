"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Trash2 } from "lucide-react";
import { ImageUploader } from "@/components/admin/image-uploader";
import { VideoUploader } from "@/components/admin/video-uploader";
import { Field } from "@/components/admin/ui";
import {
  deleteBlock,
  moveBlock,
  updateBlock,
} from "@/app/admin/_actions/blocks";
import { blockDefinition, type PageBlock } from "@/lib/blocks";
import type { Category } from "@/lib/types";

/**
 * One block, open or shut.
 *
 * Collapsed by default and showing what it is plus the first words in it,
 * because a page of eight expanded forms is unreadable and the common task is
 * "reorder these" or "turn that one off", not "edit all of them".
 *
 * Each block is its own form posting to a server action. That is the whole
 * state model — no client-side draft, no autosave, no unsaved-changes
 * negotiation. Save writes; navigating away does not.
 */
export function BlockEditor({
  block,
  page,
  categories,
  isFirst,
  isLast,
}: {
  block: PageBlock;
  page: string;
  categories: Category[];
  isFirst: boolean;
  isLast: boolean;
}) {
  const definition = blockDefinition(block.block_type);
  const [open, setOpen] = useState(false);

  if (!definition) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        This block is of a type the site no longer knows about
        ({block.block_type}). Delete it, or ask for it back.
      </div>
    );
  }

  const preview =
    block.content.heading || block.content.eyebrow || block.content.body || "";

  return (
    <div className="rounded-xl border border-sea-200 bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Reorder. Separate one-field forms rather than buttons inside the
            edit form, so moving a block never submits a half-typed one. */}
        <div className="flex flex-col">
          <MoveButton page={page} id={block.id} direction={-1} disabled={isFirst} label="Move up" />
          <MoveButton page={page} id={block.id} direction={1} disabled={isLast} label="Move down" />
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="flex items-center gap-2 font-medium">
            {definition.label}
            {!block.is_active && (
              <span className="badge bg-sea-100 text-sea-800">Hidden</span>
            )}
          </p>
          <p className="truncate text-sm text-sea-800">
            {preview || definition.summary}
          </p>
        </button>

        {block.is_active ? (
          <Eye className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Showing" />
        ) : (
          <EyeOff className="h-4 w-4 shrink-0 text-sea-800" aria-label="Hidden" />
        )}

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded p-1 hover:bg-sea-100"
          aria-expanded={open}
          aria-label={open ? "Close" : "Edit"}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-sea-200 p-4">
          <p className="mb-5 text-sm text-sea-800">{definition.summary}</p>

          <form action={updateBlock} className="space-y-5">
            <input type="hidden" name="id" value={block.id} />
            <input type="hidden" name="page" value={page} />
            <input type="hidden" name="block_type" value={block.block_type} />

            {definition.fields.map((field) => {
              const value = block.content[field.name] ?? "";

              if (field.kind === "image") {
                return (
                  <ImageUploader
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    defaultValue={value}
                    folder="pages"
                    hint={field.hint}
                  />
                );
              }

              if (field.kind === "video") {
                return (
                  <VideoUploader
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    defaultValue={value}
                    hint={field.hint}
                  />
                );
              }

              return (
                <Field key={field.name} label={field.label} hint={field.hint}>
                  {field.kind === "textarea" ? (
                    <textarea
                      name={field.name}
                      className="input min-h-24"
                      defaultValue={value}
                      placeholder={field.placeholder}
                    />
                  ) : field.kind === "select" ? (
                    <select name={field.name} className="input" defaultValue={value}>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : field.kind === "category" ? (
                    <select name={field.name} className="input" defaultValue={value}>
                      <option value="featured">My featured coffees</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.kind === "number" ? "number" : "text"}
                      name={field.name}
                      className="input"
                      defaultValue={value}
                      placeholder={field.placeholder}
                    />
                  )}
                </Field>
              );
            })}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={block.is_active}
                className="h-4 w-4 rounded border-sea-300"
              />
              Show this block on the page
            </label>

            <div className="flex items-center gap-3 border-t border-sea-200 pt-4">
              <button type="submit" className="btn-primary py-2 text-xs">
                Save block
              </button>
            </div>
          </form>

          <form action={deleteBlock} className="mt-3">
            <input type="hidden" name="id" value={block.id} />
            <input type="hidden" name="page" value={page} />
            <button
              type="submit"
              className="flex items-center gap-1.5 text-xs text-red-700 hover:underline"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete this block
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MoveButton({
  page,
  id,
  direction,
  disabled,
  label,
}: {
  page: string;
  id: string;
  direction: -1 | 1;
  disabled: boolean;
  label: string;
}) {
  return (
    <form action={moveBlock}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="page" value={page} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={label}
        className="rounded p-0.5 text-sea-800 hover:bg-sea-100 disabled:opacity-30"
      >
        {direction < 0 ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>
    </form>
  );
}
