"use client";

import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Plus,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import {
  addSection,
  moveSection,
  removeSection,
  setPageSetting,
  setPageWording,
  setSectionField,
  setSectionVisible,
  setUpHomepage,
  undoHomepageSetup,
  type EditorData,
  type EditorSection,
} from "@/app/admin/_actions/page-editor";
import { TextCell, ToggleCell } from "@/components/admin/edit-cells";
import { BlockPreview } from "@/components/admin/block-preview";
import { ImageUploader } from "@/components/admin/image-uploader";
import { VideoUploader } from "@/components/admin/video-uploader";
import { NEW_SECTION_TYPES, blockDefinition, type BlockField, type BlockType } from "@/lib/blocks";
import { cn } from "@/lib/utils";

/**
 * Edit a page as the list of sections it is.
 *
 * The same editor on the site ("Edit this page", beside the live page) and in
 * Admin → Pages. Sections are listed top to bottom as they appear; tap one to
 * open it. Every field saves itself when you leave it -- there are no Save
 * buttons -- and `onChanged` refreshes the page behind so the change is seen
 * where it lands. Rare options sit under "More options"; the page's own
 * settings (menu name, Google text) sit behind the gear.
 */
export function PageEditor({
  initial,
  load,
  onChanged,
  compact = false,
}: {
  initial: EditorData;
  /** Fetch the page again after a structural change (add, move, remove). */
  load: () => Promise<EditorData | null>;
  /** A change was saved: refresh whatever is showing the page. */
  onChanged: () => void;
  /** Narrow panel beside the live page: no thumbnails. */
  compact?: boolean;
}) {
  const [data, setData] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /** Run a structural change, then fetch the page again and refresh. */
  function structural(action: () => Promise<{ ok: boolean; error?: string }>, then?: () => void) {
    setError(null);
    startBusy(async () => {
      const result = await action().catch(() => ({ ok: false, error: "Could not reach the server." }));
      if (!result.ok) {
        setError(result.error ?? "That did not work.");
        return;
      }
      const fresh = await load().catch(() => null);
      if (fresh) setData(fresh);
      onChanged();
      then?.();
    });
  }

  /** A saved field: keep the local copy in step and refresh the page. */
  function saved<T extends { ok: boolean }>(result: T): T {
    if (result.ok) onChanged();
    return result;
  }

  const sections = data.sections;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{data.title}</p>
          <p className="text-xs text-sea-800">
            {sections.length + (data.core ? 1 : 0)} section
            {sections.length + (data.core ? 1 : 0) === 1 ? "" : "s"} · changes save as you go
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {busy && <Loader2 className="h-4 w-4 animate-spin text-sea-800" />}
          {!compact && (
            <a
              href={data.href}
              target="_blank"
              rel="noreferrer"
              className="rounded p-1.5 text-sea-800 hover:bg-sea-100"
              aria-label="View the page"
              title="View the page"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <button
            type="button"
            onClick={() => setShowSettings((on) => !on)}
            className={cn("rounded p-1.5 hover:bg-sea-100", showSettings ? "bg-sea-100 text-ink" : "text-sea-800")}
            aria-label="Page settings"
            title="Page settings"
            aria-expanded={showSettings}
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-2 text-xs text-red-800" role="alert">
          {error}
        </p>
      )}

      {showSettings && (
        <PageSettings
          data={data}
          onSaved={saved}
          onUndoSetup={() => structural(() => undoHomepageSetup())}
          onClose={() => setShowSettings(false)}
        />
      )}

      {data.needsSetup && (
        <SetUpHomepage busy={busy} onSetUp={() => structural(() => setUpHomepage())} />
      )}

      {data.core && (
        <CoreSection
          data={data}
          open={openId === "core"}
          onToggle={() => setOpenId(openId === "core" ? null : "core")}
          onSaved={saved}
        />
      )}

      {sections.map((section, index) => (
        <SectionItem
          key={section.id}
          section={section}
          categories={data.categories}
          compact={compact}
          open={openId === section.id}
          onToggle={() => setOpenId(openId === section.id ? null : section.id)}
          first={index === 0}
          last={index === sections.length - 1}
          busy={busy}
          onSaved={(result, patch) => {
            if (result.ok && patch) {
              setData((current) => ({
                ...current,
                sections: current.sections.map((item) => (item.id === section.id ? { ...item, ...patch } : item)),
              }));
            }
            return saved(result);
          }}
          onMove={(direction) => structural(() => moveSection(section.id, direction))}
          onRemove={() => structural(() => removeSection(section.id), () => setOpenId(null))}
        />
      ))}

      {!sections.length && !data.core && !data.needsSetup && (
        <p className="rounded-lg border border-dashed border-sea-300 p-4 text-center text-sm text-sea-800">
          This page is empty. Add its first section below.
        </p>
      )}

      {adding ? (
        <div className="rounded-xl border border-sea-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Add a section</p>
            <button type="button" onClick={() => setAdding(false)} className="rounded p-1 hover:bg-sea-100" aria-label="Cancel">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-2 text-xs text-sea-800">It goes at the bottom of the page; move it with the arrows.</p>
          <div className={cn("grid gap-2", !compact && "sm:grid-cols-2")}>
            {NEW_SECTION_TYPES.map((definition) => (
              <button
                key={definition.type}
                type="button"
                disabled={busy}
                onClick={() =>
                  structural(
                    async () => {
                      const result = await addSection(data.slug, definition.type);
                      if (result.ok) setOpenId(result.section.id);
                      return result;
                    },
                    () => setAdding(false),
                  )
                }
                className="flex items-start gap-3 rounded-lg border border-sea-200 p-2.5 text-left hover:border-sea-400 hover:bg-sea-50 disabled:opacity-50"
              >
                {!compact && <BlockPreview type={definition.type} />}
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{definition.label}</span>
                  <span className="block text-xs text-sea-800">{definition.summary}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        !data.needsSetup && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-sea-400 py-3 text-sm text-sea-800 hover:border-sea-700 hover:bg-sea-50"
          >
            <Plus className="h-4 w-4" /> Add a section
          </button>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SectionItem({
  section,
  categories,
  compact,
  open,
  onToggle,
  first,
  last,
  busy,
  onSaved,
  onMove,
  onRemove,
}: {
  section: EditorSection;
  categories: { id: string; name: string }[];
  compact: boolean;
  open: boolean;
  onToggle: () => void;
  first: boolean;
  last: boolean;
  busy: boolean;
  onSaved: <T extends { ok: boolean }>(result: T, patch?: Partial<EditorSection>) => T;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const definition = blockDefinition(section.type);
  const [more, setMore] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!definition) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        A kind of section the site no longer draws ({section.type}).
        <button type="button" onClick={onRemove} className="ml-2 underline">
          Remove it
        </button>
      </div>
    );
  }

  const c = section.content;
  const preview = c.heading || c.title1 || c.eyebrow || c.body || "";
  const basic = definition.fields.filter((field) => !field.advanced);
  const advanced = definition.fields.filter((field) => field.advanced);

  const saveField = (field: string) => async (value: string) =>
    onSaved(await setSectionField(section.id, field, value), {
      content: { ...section.content, [field]: value },
    });

  return (
    <div className={cn("rounded-xl border bg-white", open ? "border-sea-400" : "border-sea-200")}>
      <div className="flex items-center gap-2 px-2.5 py-2">
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={first || busy}
            aria-label="Move up"
            className="rounded p-0.5 text-sea-800 hover:bg-sea-100 disabled:opacity-25"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={last || busy}
            aria-label="Move down"
            className="rounded p-0.5 text-sea-800 hover:bg-sea-100 disabled:opacity-25"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {!compact && <BlockPreview type={section.type as BlockType} />}

        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <p className={cn("text-sm font-medium", !section.visible && "text-sea-800")}>{definition.label}</p>
          <p className="truncate text-xs text-sea-800">
            {section.visible ? preview || "Empty — open to fill it in" : "Hidden from the page"}
          </p>
        </button>

        <button
          type="button"
          onClick={async () => onSaved(await setSectionVisible(section.id, !section.visible), { visible: !section.visible })}
          className={cn("rounded p-1.5 hover:bg-sea-100", section.visible ? "text-emerald-700" : "text-sea-800")}
          aria-label={section.visible ? "Hide this section" : "Show this section"}
          title={section.visible ? "Showing — tap to hide" : "Hidden — tap to show"}
        >
          {section.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
        <button type="button" onClick={onToggle} className="rounded p-1 text-sea-800 hover:bg-sea-100" aria-label={open ? "Close" : "Edit"}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-sea-200 px-3 py-3">
          {basic.map((field) => (
            <SectionField key={field.name} field={field} value={c[field.name] ?? ""} categories={categories} onSave={saveField(field.name)} />
          ))}

          {advanced.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setMore((on) => !on)}
                className="flex items-center gap-1 text-xs text-sea-800 hover:underline"
              >
                {more ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                More options
              </button>
              {more && (
                <div className="mt-3 space-y-3 border-l-2 border-sea-100 pl-3">
                  {advanced.map((field) => (
                    <SectionField key={field.name} field={field} value={c[field.name] ?? ""} categories={categories} onSave={saveField(field.name)} />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-sea-200 pt-2.5">
            {confirming ? (
              <span className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-900">
                Remove this section from the page? Hiding it (the eye) keeps it for later.
                <button type="button" onClick={onRemove} className="btn-danger py-1 text-xs">
                  Yes, remove it
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="underline" autoFocus>
                  Cancel
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="text-xs text-sea-800 hover:text-red-700 hover:underline">
                Remove this section…
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionField({
  field,
  value,
  categories,
  onSave,
}: {
  field: BlockField;
  value: string;
  categories: { id: string; name: string }[];
  onSave: (value: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const label = (
    <p className="mb-1 text-xs font-medium text-sea-900">
      {field.label}
      {field.hint && <span className="block font-normal text-sea-800">{field.hint}</span>}
    </p>
  );

  if (field.kind === "image") {
    return <ImageUploader name={field.name} label={field.label} defaultValue={value} folder="pages" hint={field.hint} onChange={(url) => void onSave(url)} />;
  }
  if (field.kind === "video") {
    return <VideoUploader name={field.name} label={field.label} defaultValue={value} hint={field.hint} onChange={(url) => void onSave(url)} />;
  }
  if (field.kind === "select" || field.kind === "category") {
    const options =
      field.kind === "category"
        ? [{ value: "featured", label: "My featured coffees" }, ...categories.map((category) => ({ value: category.id, label: category.name }))]
        : (field.options ?? []);
    return (
      <div>
        {label}
        <SelectField value={value || (field.kind === "category" ? "featured" : "")} options={options} onSave={onSave} />
      </div>
    );
  }
  if (field.kind === "categories") {
    return (
      <div>
        {label}
        <CategoryPicker value={value} categories={categories} onSave={onSave} />
      </div>
    );
  }
  return (
    <div>
      {label}
      <TextCell
        col={`section-${field.name}`}
        value={value}
        onSave={async (next) => {
          const result = await onSave(next);
          return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Not saved." };
        }}
        multiline={field.kind === "textarea"}
        numeric={field.kind === "number"}
        placeholder={field.placeholder}
        className="border-sea-200 bg-white"
      />
    </div>
  );
}

function SelectField({
  value: initial,
  options,
  onSave,
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <select
        value={value}
        onChange={async (event) => {
          const next = event.target.value;
          const previous = value;
          setValue(next);
          const result = await onSave(next);
          if (!result.ok) {
            setValue(previous);
            setError(result.error ?? "Not saved.");
          } else setError(null);
        }}
        className="input h-9 py-0 text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </>
  );
}

/** Tick categories; the order ticked is the order shown on the page. */
function CategoryPicker({
  value,
  categories,
  onSave,
}: {
  value: string;
  categories: { id: string; name: string }[];
  onSave: (value: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [chosen, setChosen] = useState(value.split(",").filter(Boolean));
  if (!categories.length) return <p className="text-xs text-sea-800">No categories yet — add them under Categories.</p>;
  return (
    <div className="grid gap-1">
      {categories.map((category) => {
        const position = chosen.indexOf(category.id);
        return (
          <label key={category.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={position >= 0}
              onChange={async () => {
                const next = position >= 0 ? chosen.filter((id) => id !== category.id) : [...chosen, category.id];
                setChosen(next);
                await onSave(next.join(","));
              }}
              className="h-4 w-4 rounded border-sea-400"
            />
            {category.name}
            {position >= 0 && <span className="text-xs text-sea-800">#{position + 1}</span>}
          </label>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** The built-in page's own part: fixed in place, its wording editable. */
function CoreSection({
  data,
  open,
  onToggle,
  onSaved,
}: {
  data: EditorData;
  open: boolean;
  onToggle: () => void;
  onSaved: <T extends { ok: boolean }>(result: T) => T;
}) {
  const core = data.core!;
  const [showWording, setShowWording] = useState(false);
  const sections = [...new Set(core.slots.map((slot) => slot.section))];
  const editable = Boolean(core.shipped || core.slots.length);

  return (
    <div className={cn("rounded-xl border bg-sea-50", open ? "border-sea-400" : "border-sea-200")}>
      <button type="button" onClick={editable ? onToggle : undefined} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <Lock className="h-3.5 w-3.5 shrink-0 text-sea-800" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{core.label}</span>
          <span className="block text-xs text-sea-800">{core.description}</span>
        </span>
        {editable && (open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />)}
      </button>

      {open && editable && data.page && (
        <div className="space-y-3 border-t border-sea-200 px-3 py-3">
          {core.shipped && (
            <>
              <div>
                <p className="mb-1 text-xs font-medium">Heading</p>
                <TextCell col="core-heading" value={data.page.heading} placeholder={core.shipped.heading} className="border-sea-200 bg-white"
                  onSave={async (value) => onSaved(await setPageSetting(data.slug, "heading", value))} />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium">Paragraph underneath</p>
                <TextCell col="core-intro" value={data.page.intro} placeholder={core.shipped.intro} multiline className="border-sea-200 bg-white"
                  onSave={async (value) => onSaved(await setPageSetting(data.slug, "intro", value))} />
              </div>
              <p className="text-xs text-sea-800">Leave a box empty to keep the original wording (shown faintly).</p>
            </>
          )}

          {core.slots.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowWording((on) => !on)} className="flex items-center gap-1 text-xs text-sea-800 hover:underline">
                {showWording ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Edit all the other wording ({core.slots.length} pieces, including the form)
              </button>
              {showWording && (
                <div className="mt-3 space-y-4">
                  {sections.map((name) => (
                    <div key={name} className="space-y-2">
                      <p className="text-[11px] uppercase tracking-wider text-sea-800">{name}</p>
                      {core.slots
                        .filter((slot) => slot.section === name)
                        .map((slot) => (
                          <div key={slot.key}>
                            <p className="mb-1 text-xs">{slot.label}</p>
                            <TextCell
                              col={`slot-${slot.key}`}
                              value={data.page?.copy[slot.key] ?? ""}
                              placeholder={slot.value}
                              multiline={slot.multiline}
                              className="border-sea-200 bg-white"
                              onSave={async (value) => onSaved(await setPageWording(data.slug, slot.key, value))}
                            />
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SetUpHomepage({ busy, onSetUp }: { busy: boolean; onSetUp: () => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <div className="rounded-xl border border-sea-300 bg-white p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-sea-800" /> Make the whole homepage editable here
      </p>
      <p className="mt-1 text-sm text-sea-800">
        Right now parts of the homepage come from Site settings and parts are written into the site.
        This copies all of it — the big picture, its words, your chosen categories, every heading — into
        sections you can edit, move or hide from here. Nothing is deleted, and it can be undone from the
        gear menu.
      </p>
      {asking ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={onSetUp} disabled={busy} className="btn-primary py-2 text-xs">
            {busy ? "Setting up…" : "Yes, set it up"}
          </button>
          <button type="button" onClick={() => setAsking(false)} className="text-xs underline">
            Not now
          </button>
          <span className="text-xs text-sea-800">The words stay the same; headings take on the sections&apos; style.</span>
        </div>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className="btn-primary mt-3 py-2 text-xs">
          Set up the homepage
        </button>
      )}
    </div>
  );
}

function PageSettings({
  data,
  onSaved,
  onUndoSetup,
  onClose,
}: {
  data: EditorData;
  onSaved: <T extends { ok: boolean }>(result: T) => T;
  onUndoSetup: () => void;
  onClose: () => void;
}) {
  const [confirmUndo, setConfirmUndo] = useState(false);
  if (!data.page) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        This page&apos;s settings are not in the database yet. Paste supabase/setup.sql into Supabase and reload.
      </div>
    );
  }
  const page = data.page;
  const save = (field: Parameters<typeof setPageSetting>[1]) => async (value: string | boolean) =>
    onSaved(await setPageSetting(data.slug, field, value));

  return (
    <div className="space-y-3 rounded-xl border border-sea-300 bg-white p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Page settings</p>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-sea-100" aria-label="Close settings">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium">Name in the menu</p>
        <TextCell col="page-title" value={page.title} onSave={save("title")} className="border-sea-200" />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm">Show in the top menu</span>
        <ToggleCell value={page.showInNav} onSave={save("showInNav")} label="Show in the top menu" />
      </div>
      {!data.isBuiltIn && (
        <div className="flex items-center justify-between">
          <span className="text-sm">Published — visitors can see it</span>
          <ToggleCell value={page.isPublished} onSave={save("isPublished")} label="Published" />
        </div>
      )}
      <p className="text-xs text-sea-800">
        Address: <span className="font-mono">{data.href}</span> · Menu order is set on the Pages list.
      </p>
      <div>
        <p className="mb-1 text-xs font-medium">Title on Google</p>
        <TextCell col="page-seo-title" value={page.seoTitle} onSave={save("seoTitle")} placeholder={page.title} className="border-sea-200" />
      </div>
      <div>
        <p className="mb-1 text-xs font-medium">Description on Google</p>
        <TextCell col="page-seo-description" value={page.seoDescription} onSave={save("seoDescription")} multiline className="border-sea-200" />
      </div>
      {data.canUndoSetup && (
        <div className="border-t border-sea-200 pt-2.5 text-xs">
          {confirmUndo ? (
            <span className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-2.5 py-2 text-red-900">
              Put the old homepage back? The sections the setup made are removed, with any changes made to
              them; sections you added yourself stay.
              <button type="button" onClick={onUndoSetup} className="btn-danger py-1 text-xs">
                Yes, undo the setup
              </button>
              <button type="button" onClick={() => setConfirmUndo(false)} className="underline">
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmUndo(true)} className="text-sea-800 hover:underline">
              Undo the homepage setup…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
