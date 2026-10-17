"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileSpreadsheet, ImageUp, Loader2, TriangleAlert } from "lucide-react";
import {
  applyPriceImport,
  readPriceListImage,
  type PriceImportResult,
} from "@/app/admin/_actions/price-import";
import { compressImage } from "@/lib/image-compression";
import {
  nameKey,
  parsePriceList,
  planItem,
  suggestMatch,
  type PlanCatalogueProduct,
  type PlanItem,
  type PriceListRow,
} from "@/lib/price-list";
import { cn, formatIDR } from "@/lib/utils";

/**
 * "Import price list": paste the rows from the roastery's spreadsheet and
 * bring the shop in line with it.
 *
 * Shows every change before making it -- new coffees, new sizes, prices that
 * moved, sizes and coffees that are no longer on the list -- and lets the
 * operator link a row to an existing coffee when the names differ, so a
 * renamed coffee updates instead of turning up twice.
 */
export function PriceImport({ catalogue }: { catalogue: PlanCatalogueProduct[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<PriceListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Row index -> the coffee it is linked to by hand ("" = add as new).
  const [links, setLinks] = useState<Record<number, string>>({});
  // Nothing new is made and nothing is switched off unless it is ticked:
  // row indices of new coffees to add, and sizes to take off sale.
  const [addNew, setAddNew] = useState<Set<number>>(new Set());
  const [offSizes, setOffSizes] = useState<Set<string>>(new Set());
  const [hide, setHide] = useState<Set<string>>(new Set());
  const [showNew, setShowNew] = useState(false);
  const [result, setResult] = useState<PriceImportResult | null>(null);
  const [applying, startApplying] = useTransition();
  // Set when the rows came from a picture: what could not be read, and a
  // reminder that a picture is read, not copied, so prices deserve a look.
  const [fromImage, setFromImage] = useState<{ unreadable: string[] } | null>(null);
  const [readingImage, startReadingImage] = useTransition();

  const byKey = useMemo(
    () => new Map(catalogue.map((product) => [nameKey(product.name), product])),
    [catalogue],
  );

  const items: PlanItem[] = useMemo(() => {
    if (!rows) return [];
    return rows.map((row, index) => {
      const linked = links[index];
      const product =
        linked === undefined
          ? (byKey.get(nameKey(row.name)) ?? null)
          : (catalogue.find((item) => item.id === linked) ?? null);
      return planItem(row, product);
    });
  }, [rows, links, byKey, catalogue]);

  const usedIds = new Set(items.map((item) => item.productId).filter(Boolean) as string[]);

  // Near-miss names: for each unlinked row, the one shop coffee it probably
  // is. A coffee that more than one row could be is ambiguous ("Kamojang" vs
  // two Kamojang lots), so none of them gets it -- the dropdown decides.
  const suggestions = items.map((item, index) =>
    !item.productId && links[index] === undefined
      ? suggestMatch(
          item.row.name,
          catalogue.filter((product) => !usedIds.has(product.id)),
        )
      : null,
  );
  const suggestedTimes = new Map<string, number>();
  for (const suggestion of suggestions) {
    if (suggestion) suggestedTimes.set(suggestion.id, (suggestedTimes.get(suggestion.id) ?? 0) + 1);
  }
  const missing = catalogue.filter((product) => product.is_active && !usedIds.has(product.id));

  // Rows waiting on "is this the same coffee?": these must be answered before
  // anything is applied, so a near-duplicate is never created by default.
  const openQuestion = (index: number) => {
    const candidate = suggestions[index];
    return candidate && suggestedTimes.get(candidate.id) === 1 ? candidate : null;
  };
  const pendingQuestions = items.filter((_, index) => openQuestion(index)).length;
  const newRows = items
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => !item.productId && !openQuestion(index));

  const counts = {
    added: items.filter((item, index) => !item.productId && addNew.has(index)).length,
    unticked: newRows.filter(({ index }) => !addNew.has(index)).length,
    prices: items.flatMap((item) => item.changes).filter((change) => change.kind === "price").length,
    sizes: items
      .filter((item) => item.productId)
      .flatMap((item) => item.changes)
      .filter((change) => change.kind === "new").length,
    off: items.flatMap((item) => item.notListed).filter((size) => offSizes.has(size.variantId)).length,
  };
  const nothingToDo =
    counts.added + counts.prices + counts.sizes + counts.off + hide.size === 0 &&
    !items.some((item) => item.changes.some((change) => change.kind === "back_on_sale"));

  function showRows(next: PriceListRow[]) {
    setRows(next);
    setLinks({});
    setAddNew(new Set());
    setOffSizes(new Set());
    setHide(new Set());
  }

  /** A screenshot or photo of the list, read by Claude on the server. */
  function readImage(file: File) {
    setError(null);
    setResult(null);
    startReadingImage(async () => {
      let upload: File = file;
      try {
        // Small enough to send, large enough that every price stays legible.
        upload = (await compressImage(file, { maxDimension: 2400, maxBytes: 700_000 })).file;
      } catch {
        // Unreadable in the browser (HEIC, say): send as is and let the server say.
      }
      const form = new FormData();
      form.set("image", upload);
      const outcome = await readPriceListImage(form).catch(() => null);
      if (!outcome) {
        setError("Could not reach the server. Try again.");
        return;
      }
      if (outcome.error) {
        setError(outcome.error);
        return;
      }
      setFromImage({ unreadable: outcome.unreadable });
      showRows(outcome.rows);
    });
  }

  function read(source: string) {
    const parsed = parsePriceList(source);
    setResult(null);
    setFromImage(null);
    if (parsed.error) {
      setError(parsed.error);
      setRows(null);
      return;
    }
    setError(null);
    showRows(parsed.rows);
  }

  function apply() {
    startApplying(async () => {
      const outcome = await applyPriceImport({
        // New coffees only when ticked; everything else is an update.
        items: items
          .filter((item, index) => item.productId || addNew.has(index))
          .map((item) => ({
            productId: item.productId,
            name: item.row.name,
            region: item.row.region,
            sizes: item.row.sizes,
            offSaleVariantIds: item.notListed
              .map((size) => size.variantId)
              .filter((id) => offSizes.has(id)),
          })),
        hideProductIds: Array.from(hide),
        showNewCoffees: showNew,
      }).catch(() => null);

      if (!outcome) {
        setError("Could not reach the server. Some changes may have been made — check the sheet.");
        return;
      }
      setResult(outcome);
      setRows(null);
      setText("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary mb-5 py-2 text-sm"
      >
        <FileSpreadsheet className="h-4 w-4" /> Import price list
      </button>
    );
  }

  return (
    <div className="mb-5 rounded-xl border border-sea-200 bg-white p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <FileSpreadsheet className="h-4 w-4 text-sea-800" /> Import price list
          </p>
          <p className="text-xs text-sea-800">
            In your spreadsheet, select from the header row (Coffee, 15gr, 45gr… 1KG) down to
            the last coffee, copy, and paste here. Region rows like “Jawa Barat” are fine. Or
            upload (or paste) a screenshot or photo of the list.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setRows(null);
            setError(null);
            setResult(null);
          }}
          className="text-xs text-sea-800 hover:underline"
        >
          Close
        </button>
      </div>

      {!rows && !result && (
        <>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onPaste={(event) => {
              // A screenshot pasted straight in.
              const picture = Array.from(event.clipboardData.files).find((item) =>
                item.type.startsWith("image/"),
              );
              if (picture) {
                event.preventDefault();
                readImage(picture);
                return;
              }
              const pasted = event.clipboardData.getData("text");
              if (!text.trim() && pasted.trim()) {
                event.preventDefault();
                setText(pasted);
                read(pasted);
              }
            }}
            rows={5}
            placeholder={"Coffee\t15gr\t30gr\t45gr\t75gr\t150gr\t300gr\t1KG\nJawa Barat\nPalintang Washed Java Ateng\t\t\t58,000\t75,000\t140,000\t250,000"}
            className="input font-mono text-xs"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <label
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-sea-400 px-3 py-2 text-sm text-sea-800 hover:border-sea-700 hover:bg-sea-50",
                readingImage && "pointer-events-none opacity-60",
              )}
            >
              {readingImage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageUp className="h-4 w-4" />
              )}
              {readingImage ? "Reading the picture…" : "Or upload a screenshot or photo"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) readImage(file);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => read(text)}
              disabled={!text.trim() || readingImage}
              className="btn-primary py-2 text-sm"
            >
              Check the list
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-800" role="alert">
          {error}
        </p>
      )}

      {rows && (
        <div className="mt-2">
          {fromImage && (
            <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p>
                <strong>Read from a picture.</strong> Check the prices below against your list
                before applying — a picture is read, not copied, so a blurry digit can slip.
              </p>
              {fromImage.unreadable.length > 0 && (
                <ul className="mt-1 list-disc pl-5">
                  {fromImage.unreadable.map((line) => (
                    <li key={line}>Could not read: {line}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sea-50 px-3 py-2 text-sm">
            <p>
              {rows.length} coffees on the list. Nothing is added, switched off or hidden
              unless you tick it, and nothing changes until you press Apply.
            </p>
            {newRows.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setAddNew(
                    counts.unticked === 0
                      ? new Set()
                      : new Set(newRows.map(({ index }) => index)),
                  )
                }
                className="text-xs text-sea-800 underline"
              >
                {counts.unticked === 0
                  ? "Untick all new coffees"
                  : `Tick all ${newRows.length} new coffees`}
              </button>
            )}
          </div>

          <ul className="divide-y divide-sea-200 rounded-lg border border-sea-200">
            {items.map((item, index) => {
              const changed = item.changes.filter((change) => change.kind !== "same");
              const same = item.changes.length - changed.length;
              const suggestion = openQuestion(index);
              const skipped = !item.productId && !suggestion && !addNew.has(index);
              return (
                <li key={index} className={cn("px-3 py-2 text-sm", skipped && "bg-sea-50/60")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0">
                      <span className="font-medium">{item.row.name}</span>
                      {item.row.region && (
                        <span className="text-xs text-sea-800"> · {item.row.region}</span>
                      )}
                    </p>
                    <select
                      value={links[index] ?? item.productId ?? ""}
                      onChange={(event) =>
                        setLinks((current) => ({ ...current, [index]: event.target.value }))
                      }
                      className="input h-8 w-auto max-w-[16rem] py-0 text-xs"
                      aria-label={`Which coffee is ${item.row.name}`}
                    >
                      <option value="">Not in the shop yet</option>
                      {catalogue.map((product) => (
                        <option key={product.id} value={product.id}>
                          Update “{product.name}”
                        </option>
                      ))}
                    </select>
                  </div>

                  {suggestion && (
                    <p className="mt-1 flex flex-wrap items-center gap-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
                      Is this “{suggestion.name}” in your shop?
                      <button
                        type="button"
                        onClick={() => setLinks((current) => ({ ...current, [index]: suggestion.id }))}
                        className="font-medium underline"
                      >
                        Yes, update it
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLinks((current) => ({ ...current, [index]: "" }));
                          // Answering "new" is the decision to add it.
                          setAddNew((current) => new Set(current).add(index));
                        }}
                        className="underline"
                      >
                        No, add it as a new coffee
                      </button>
                    </p>
                  )}

                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    {!item.productId && !suggestion && (
                      <label
                        className={cn(
                          "flex items-center gap-1 rounded px-1.5 py-0.5",
                          addNew.has(index)
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-white text-sea-800 ring-1 ring-sea-200",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={addNew.has(index)}
                          onChange={() =>
                            setAddNew((current) => {
                              const next = new Set(current);
                              if (next.has(index)) next.delete(index);
                              else next.add(index);
                              return next;
                            })
                          }
                          className="h-3.5 w-3.5 rounded border-sea-400"
                        />
                        {addNew.has(index) ? "Will be added" : "Add this coffee"}
                      </label>
                    )}
                    {changed.map((change) => (
                      <span
                        key={change.size}
                        className={cn(
                          "rounded px-1.5 py-0.5",
                          change.kind === "price" ? "bg-amber-100 text-amber-900" : "bg-sea-100 text-sea-900",
                        )}
                      >
                        {change.kind === "price"
                          ? `${change.size} ${formatIDR(change.was)} → ${formatIDR(change.price)}`
                          : change.kind === "back_on_sale"
                            ? `${change.size} ${formatIDR(change.price)}, back on sale`
                            : `${item.productId ? "+ " : ""}${change.size} ${formatIDR(change.price)}`}
                      </span>
                    ))}
                    {same > 0 && item.productId && (
                      <span className="px-1 text-sea-800">{same} unchanged</span>
                    )}
                  </div>

                  {item.notListed.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-sea-800">
                      {item.notListed.map((size) => (
                        <label key={size.variantId} className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={offSizes.has(size.variantId)}
                            onChange={() =>
                              setOffSizes((current) => {
                                const next = new Set(current);
                                if (next.has(size.variantId)) next.delete(size.variantId);
                                else next.add(size.variantId);
                                return next;
                              })
                            }
                            className="h-3.5 w-3.5 rounded border-sea-400"
                          />
                          Take {size.size} off sale (not on the list)
                        </label>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {missing.length > 0 && (
            <div className="mt-3 rounded-lg border border-sea-200 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">On the shop but not on this list</p>
                <button
                  type="button"
                  onClick={() =>
                    setHide(hide.size === missing.length ? new Set() : new Set(missing.map((p) => p.id)))
                  }
                  className="text-xs text-sea-800 underline"
                >
                  {hide.size === missing.length ? "Keep all" : "Hide all"}
                </button>
              </div>
              <p className="mb-2 text-xs text-sea-800">
                Tick the ones you no longer sell to hide them. Nothing is deleted — you can
                switch them back on in the sheet.
              </p>
              <div className="grid gap-1 sm:grid-cols-2">
                {missing.map((product) => (
                  <label key={product.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={hide.has(product.id)}
                      onChange={() =>
                        setHide((current) => {
                          const next = new Set(current);
                          if (next.has(product.id)) next.delete(product.id);
                          else next.add(product.id);
                          return next;
                        })
                      }
                      className="h-4 w-4 rounded border-sea-400"
                    />
                    Hide {product.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={showNew}
              onChange={() => setShowNew((on) => !on)}
              className="mt-0.5 h-4 w-4 rounded border-sea-400"
            />
            <span>
              Show new coffees on the shop straight away
              <span className="block text-xs text-sea-800">
                Otherwise they are added hidden, so you can add a photo and notes first. New
                sizes start with 0 stock — add stock in the sheet after roasting (the till
                can still sell them).
              </span>
            </span>
          </label>

          <div className="mt-3 rounded-lg border border-sea-200 px-3 py-2 text-sm">
            {pendingQuestions > 0 ? (
              <p className="text-amber-900">
                Answer the {pendingQuestions} “is this the same coffee?”{" "}
                {pendingQuestions === 1 ? "question" : "questions"} above first.
              </p>
            ) : nothingToDo ? (
              <p className="text-sea-800">Nothing to change — the shop already matches what is ticked.</p>
            ) : (
              <p>
                Apply will:{" "}
                {[
                  counts.added > 0 && `add ${counts.added} new coffee${counts.added === 1 ? "" : "s"}${showNew ? "" : " (hidden)"}`,
                  counts.prices > 0 && `change ${counts.prices} price${counts.prices === 1 ? "" : "s"}`,
                  counts.sizes > 0 && `add ${counts.sizes} size${counts.sizes === 1 ? "" : "s"} to existing coffees`,
                  counts.off > 0 && `take ${counts.off} size${counts.off === 1 ? "" : "s"} off sale`,
                  hide.size > 0 && `hide ${hide.size} coffee${hide.size === 1 ? "" : "s"}`,
                ]
                  .filter(Boolean)
                  .join(", ") || "put sizes back on sale"}
                . Nothing is deleted.
                {counts.unticked > 0 && (
                  <span className="text-sea-800">
                    {" "}
                    {counts.unticked} new coffee{counts.unticked === 1 ? " is" : "s are"} not ticked and
                    will be skipped.
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="mt-3 flex justify-end gap-3">
            <button type="button" onClick={() => setRows(null)} className="text-sm text-sea-800 hover:underline">
              Back
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={applying || pendingQuestions > 0 || nothingToDo}
              className="btn-primary py-2 text-sm"
            >
              {applying ? "Applying…" : "Apply"}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div
          className={cn(
            "mt-2 rounded-lg p-3 text-sm",
            result.ok ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900",
          )}
        >
          <p className="flex items-center gap-1.5 font-medium">
            {result.ok ? <Check className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
            {result.ok ? "Done." : "Done, with some problems."}
          </p>
          <p className="mt-1 text-xs">
            {result.added} coffee{result.added === 1 ? "" : "s"} added, {result.updatedPrices} price
            {result.updatedPrices === 1 ? "" : "s"} changed, {result.newSizes} size
            {result.newSizes === 1 ? "" : "s"} added, {result.offSale} size
            {result.offSale === 1 ? "" : "s"} taken off sale, {result.hidden} coffee
            {result.hidden === 1 ? "" : "s"} hidden.
          </p>
          {result.failures.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {result.failures.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
