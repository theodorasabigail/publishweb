"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import {
  compressImage,
  formatBytes,
  presetFor,
  type CompressionResult,
} from "@/lib/image-compression";
import { checkMediaBudget } from "@/app/admin/_actions/settings";
import { createClient } from "@/lib/supabase/client";

/**
 * Uploads to the Supabase Storage `media` bucket from the browser, using the
 * admin's own session.
 *
 * Images are resized and re-encoded here, before upload. That is deliberate:
 * the free Supabase plan has no image transformation service, so whatever gets
 * stored is exactly what gets served, and an unshrunk photo library will eat
 * both the 1 GB storage and the 5 GB monthly egress allowance.
 */

/** Ceiling on what we will even attempt to read into a canvas. Anything
 *  larger is a mistake -- a raw camera export or a video -- not a product
 *  photo, and decoding it can hang a phone browser. */
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

export function ImageUploader({
  name,
  label,
  defaultValue,
  folder = "uploads",
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  folder?: string;
  hint?: string;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    if (!picked) return;

    setError(null);
    setResult(null);

    if (picked.size > MAX_INPUT_BYTES) {
      setError(
        `That file is ${formatBytes(picked.size)}. Please pick an image under 25 MB.`,
      );
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setBusy(true);

    try {
      // One step before the wall: refuse rather than let Supabase fail with
      // whatever error it returns when the plan is full.
      const budget = await checkMediaBudget();
      if (budget.blocked) {
        setError(budget.message);
        return;
      }
      if (budget.message) setWarning(budget.message);

      setStatus("Resizing…");
      const compressed = await compressImage(picked, presetFor(folder));

      setStatus("Uploading…");
      const supabase = createClient();
      const extension = compressed.file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(path, compressed.file, {
          cacheControl: "31536000",
          contentType: compressed.file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("media").getPublicUrl(path);

      setUrl(publicUrl);
      setResult(compressed);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload that image.",
      );
    } finally {
      setBusy(false);
      setStatus(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={url} />

      {url ? (
        <div className="relative w-fit">
          {/* Storage URLs vary by project, so a plain img keeps this working
              without touching next.config image hosts. Admin-only, and the
              stored file is already small. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            className="h-32 w-32 rounded-lg border border-bark-200 object-cover"
          />
          <button
            type="button"
            onClick={() => {
              setUrl("");
              setResult(null);
            }}
            className="absolute -right-2 -top-2 rounded-full bg-white p-1 shadow ring-1 ring-bark-200 hover:bg-red-50"
            aria-label="Remove image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex h-32 w-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-bark-300 px-2 text-center text-xs text-bark-600 hover:border-bark-500"
        >
          {busy ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {status}
            </>
          ) : (
            <>
              <ImagePlus className="h-5 w-5" />
              Upload
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onPick}
        className="hidden"
      />

      {result?.wasCompressed && (
        <p className="mt-1.5 text-xs text-emerald-700">
          Shrunk from {formatBytes(result.originalBytes)} to{" "}
          {formatBytes(result.bytes)} before uploading.
        </p>
      )}

      {warning && <p className="mt-1.5 text-xs text-amber-700">{warning}</p>}
      {hint && <p className="mt-1.5 text-xs text-bark-600">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  );
}
