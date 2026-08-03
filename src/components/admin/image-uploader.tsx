"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Uploads straight to the Supabase Storage `media` bucket from the browser,
 * using the admin's own session. The operator picks a file; the public URL
 * lands in a hidden input and gets saved with the rest of the form.
 */
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
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setError("That image is over 8 MB. Please use a smaller one.");
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(path, file, { cacheControl: "31536000", upsert: false });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("media").getPublicUrl(path);

      setUrl(publicUrl);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload that image.",
      );
    } finally {
      setBusy(false);
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
              without touching next.config image hosts. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            className="h-32 w-32 rounded-lg border border-bark-200 object-cover"
          />
          <button
            type="button"
            onClick={() => setUrl("")}
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
          className="flex h-32 w-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-bark-300 text-xs text-bark-500 hover:border-bark-500"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
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

      {hint && <p className="mt-1.5 text-xs text-bark-500">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  );
}
