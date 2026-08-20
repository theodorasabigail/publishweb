"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Film, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatBytes } from "@/lib/image-compression";

/**
 * Video and GIF, with the bill stated up front.
 *
 * Images go through the optimiser: Vercel fetches each one from Supabase once,
 * makes its own copies and serves those. Video does not. Every play is fetched
 * straight from Supabase storage, so the monthly egress allowance is divided
 * by the file size and that is how many plays are left.
 *
 * A 4 MB loop and a 5 GB allowance is about 1,250 plays a month. That is a
 * real number a shop can hit in a good week, and hitting it takes the images
 * down with it — they share one allowance. So the limit here is deliberately
 * low, and the projection is shown before the upload rather than explained
 * afterwards.
 *
 * A GIF is worse than a video of the same length and is treated identically;
 * the format is accepted because people have them, not because it is wise.
 */

/** Above this, the arithmetic stops working on the free plan. */
const MAX_BYTES = 8 * 1024 * 1024;
const SUPABASE_MONTHLY_EGRESS = 5 * 1024 * 1024 * 1024;

export function VideoUploader({
  name,
  label,
  defaultValue,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  hint?: string;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    if (!picked) return;

    setError(null);
    setNote(null);

    if (picked.size > MAX_BYTES) {
      setError(
        `That file is ${formatBytes(picked.size)}. Keep it under ${formatBytes(MAX_BYTES)} — ` +
          `a shorter clip, or a smaller frame size. Above that, one popular video can use ` +
          `a month of the free plan's traffic on its own.`,
      );
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const extension = picked.name.split(".").pop()?.toLowerCase() ?? "mp4";
      const path = `video/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(path, picked, { cacheControl: "31536000", upsert: false });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("media").getPublicUrl(path);

      setUrl(publicUrl);

      const plays = Math.floor(SUPABASE_MONTHLY_EGRESS / picked.size);
      setNote(
        `Uploaded, ${formatBytes(picked.size)}. At that size the free plan covers roughly ` +
          `${plays.toLocaleString("en-GB")} plays a month, shared with all your images.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That upload did not work.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <span className="label">{label}</span>

      {url ? (
        <div className="flex items-start gap-3 rounded-lg border border-sea-200 bg-white p-3">
          <video
            src={url}
            className="h-24 w-32 shrink-0 rounded bg-sea-100 object-cover"
            muted
            loop
            playsInline
            preload="metadata"
          />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Film className="h-4 w-4" /> Video set
            </p>
            <p className="mt-1 break-all text-xs text-sea-800">{url}</p>
            <button
              type="button"
              onClick={() => {
                setUrl("");
                setNote(null);
              }}
              className="mt-2 flex items-center gap-1 text-xs text-red-700 hover:underline"
            >
              <X className="h-3 w-3" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,image/gif"
            onChange={onPick}
            disabled={busy}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-sea-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <p className="mt-2 text-xs text-sea-800">
            MP4 or WebM, under {formatBytes(MAX_BYTES)}. It plays silently on a
            loop, so keep it short — a few seconds is plenty. Set the picture
            above as well: it shows first, and stands in on slow connections.
          </p>
        </div>
      )}

      <input type="hidden" name={name} value={url} />

      {busy && <p className="mt-2 text-xs text-sea-800">Uploading…</p>}
      {note && <p className="mt-2 text-xs text-sea-800">{note}</p>}
      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
      {hint && !error && <p className="mt-1.5 text-xs text-sea-800">{hint}</p>}
    </div>
  );
}
