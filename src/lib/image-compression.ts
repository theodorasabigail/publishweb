/**
 * Shrink images in the browser before they are uploaded.
 *
 * Supabase's free plan gives 1 GB of file storage and 5 GB of monthly egress,
 * and does *not* include image transformations -- there is no server-side
 * resizing to fall back on. So a 6 MB photo straight off a phone would be
 * stored at 6 MB and re-fetched at 6 MB every time Vercel generates a new
 * size variant of it. Twenty product photos like that is most of the storage
 * quota gone and a steady drip of egress.
 *
 * Re-encoding here caps both at the only point where it is free to do so.
 * Typical result for a phone photo: 4-8 MB in, 120-250 KB out, with no
 * visible difference at the sizes the site actually displays.
 */

export interface CompressionResult {
  file: File;
  originalBytes: number;
  bytes: number;
  /** False when the file was passed through untouched (SVG, tiny images). */
  wasCompressed: boolean;
}

export interface CompressionPreset {
  /** Longest edge, in pixels, after scaling down. Never scales up. */
  maxDimension: number;
  /** Target file size. Quality steps down until the result fits. */
  maxBytes: number;
}

/**
 * Sized against how each image is actually displayed, not against how big it
 * could theoretically be. The product grid never renders above ~800px wide,
 * so a 1600px original already covers a 2x retina screen.
 */
export const IMAGE_PRESETS: Record<string, CompressionPreset> = {
  products: { maxDimension: 1600, maxBytes: 300_000 },
  blog: { maxDimension: 2000, maxBytes: 400_000 },
  hero: { maxDimension: 2400, maxBytes: 500_000 },
  banner: { maxDimension: 2000, maxBytes: 300_000 },
  categories: { maxDimension: 1200, maxBytes: 250_000 },
  social: { maxDimension: 1200, maxBytes: 250_000 },
  uploads: { maxDimension: 1600, maxBytes: 300_000 },
};

export function presetFor(folder: string): CompressionPreset {
  return IMAGE_PRESETS[folder] ?? IMAGE_PRESETS.uploads;
}

const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.5, 0.4];

/** Formats we deliberately leave alone. */
function isPassThrough(type: string): boolean {
  // SVG is already tiny and re-encoding it to a bitmap would be a downgrade.
  // Animated GIFs would lose their animation on a canvas round-trip.
  return type === "image/svg+xml" || type === "image/gif";
}

export async function compressImage(
  file: File,
  preset: CompressionPreset,
): Promise<CompressionResult> {
  const originalBytes = file.size;

  if (!file.type.startsWith("image/")) {
    throw new Error("That file is not an image.");
  }

  if (isPassThrough(file.type)) {
    return { file, originalBytes, bytes: originalBytes, wasCompressed: false };
  }

  let bitmap: ImageBitmap;
  try {
    // `from-image` applies EXIF orientation, so portrait phone photos do not
    // come out rotated.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That image could not be read. Try saving it as a JPEG or PNG.");
  }

  const scale = Math.min(
    1,
    preset.maxDimension / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Your browser could not process that image.");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const supportsWebp = await canEncodeWebp(canvas);

  // WebP where available: roughly 25-35% smaller than JPEG at the same
  // quality, and it keeps transparency.
  if (supportsWebp) {
    const encoded = await encodeUnder(canvas, "image/webp", preset.maxBytes);
    if (encoded) {
      return finalise(file, encoded, "webp", originalBytes);
    }
  }

  // JPEG fallback. It has no alpha channel, so anything transparent would
  // otherwise come out black -- paint the canvas white underneath first.
  const flattened = document.createElement("canvas");
  flattened.width = width;
  flattened.height = height;
  const flatContext = flattened.getContext("2d");
  if (flatContext) {
    flatContext.fillStyle = "#ffffff";
    flatContext.fillRect(0, 0, width, height);
    flatContext.drawImage(canvas, 0, 0);
  }

  const jpeg = await encodeUnder(flatContext ? flattened : canvas, "image/jpeg", preset.maxBytes);
  if (jpeg) {
    return finalise(file, jpeg, "jpg", originalBytes);
  }

  // Every quality step was still over target. Keep the smallest attempt
  // rather than failing the upload outright.
  const lastResort = await toBlob(canvas, "image/jpeg", 0.4);
  if (!lastResort) throw new Error("That image could not be compressed.");
  return finalise(file, lastResort, "jpg", originalBytes);
}

/** Try decreasing quality until the blob fits under `maxBytes`. */
async function encodeUnder(
  canvas: HTMLCanvasElement,
  mimeType: string,
  maxBytes: number,
): Promise<Blob | null> {
  for (const quality of QUALITY_STEPS) {
    const blob = await toBlob(canvas, mimeType, quality);
    if (blob && blob.type === mimeType && blob.size <= maxBytes) {
      return blob;
    }
  }
  return null;
}

function toBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
}

/** Safari only gained canvas WebP encoding recently; older versions silently
 *  hand back a PNG instead, which would be larger than what we started with. */
async function canEncodeWebp(canvas: HTMLCanvasElement): Promise<boolean> {
  const probe = await toBlob(canvas, "image/webp", 0.5);
  return probe?.type === "image/webp";
}

function finalise(
  original: File,
  blob: Blob,
  extension: string,
  originalBytes: number,
): CompressionResult {
  // If compression somehow made it bigger (already-optimised small images),
  // keep whichever is smaller.
  if (blob.size >= originalBytes) {
    return {
      file: original,
      originalBytes,
      bytes: originalBytes,
      wasCompressed: false,
    };
  }

  const baseName = original.name.replace(/\.[^.]+$/, "") || "image";
  const file = new File([blob], `${baseName}.${extension}`, { type: blob.type });

  return { file, originalBytes, bytes: file.size, wasCompressed: true };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
