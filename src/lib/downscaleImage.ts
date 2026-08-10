import { MAX_REQUEST_BYTES } from './uploadLimits'

/**
 * Shrinks a photo in the browser before it is uploaded.
 *
 * Two jobs. The obvious one is speed: a phone photo is several megabytes,
 * which on a 3G connection is most of a minute of uploading, on the
 * patient's own data, before a pharmacist sees anything.
 *
 * The load-bearing one is that it has to succeed. A serverless request
 * body is rejected at roughly 4.5 MB before our handler runs, so a photo
 * that leaves here full-size does not upload slowly — it fails, with a
 * platform error page that carries no explanation. The original version
 * gave up and returned the file untouched whenever anything was missing,
 * which on iOS Safari (no OffscreenCanvas before 16.4) meant every photo.
 * That is the bug behind "network problem" on a good connection.
 *
 * So every step now has a fallback, and the last one is a loop: if the
 * result is still over budget it re-encodes smaller until it fits.
 */

/** Matches the server's cap, so neither side has to redo the other's work. */
const QUALITY = 0.82

/** Below this there is nothing worth doing. */
const MIN_BYTES_TO_BOTHER = 400 * 1024

/**
 * The photo's share of the request. The rest is the note, the multipart
 * boundaries and a voice note that can itself run to a few hundred KB.
 */
const PHOTO_BUDGET = Math.floor(MAX_REQUEST_BYTES * 0.7)

/** Progressively smaller attempts, used only while the result is too big. */
const RETRIES: { dimension: number; quality: number }[] = [
  { dimension: 1600, quality: QUALITY },
  { dimension: 1280, quality: 0.75 },
  { dimension: 1024, quality: 0.7 },
  { dimension: 800, quality: 0.65 },
]

/** Decodes to something drawable, whatever the browser supports. */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      // imageOrientation applies the EXIF rotation while decoding —
      // without it a sideways photo is re-encoded sideways, and the tag
      // that said so is lost in the process.
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      try {
        // Older Safari has createImageBitmap but rejects the options bag.
        return await createImageBitmap(file)
      } catch {
        /* fall through to the <img> path */
      }
    }
  }
  // Works everywhere, including browsers with no createImageBitmap at all.
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } catch {
    return null
  } finally {
    // The bitmap is already in memory by the time decode() resolves.
    URL.revokeObjectURL(url)
  }
}

function sizeOf(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  return source instanceof HTMLImageElement
    ? { width: source.naturalWidth, height: source.naturalHeight }
    : { width: source.width, height: source.height }
}

/** Encodes at a given size, preferring WebP and accepting JPEG. */
async function encode(
  source: ImageBitmap | HTMLImageElement,
  dimension: number,
  quality: number,
): Promise<Blob | null> {
  const { width: sw, height: sh } = sizeOf(source)
  if (!sw || !sh) return null
  const scale = Math.min(1, dimension / Math.max(sw, sh))
  const width = Math.max(1, Math.round(sw * scale))
  const height = Math.max(1, Math.round(sh * scale))

  // OffscreenCanvas where it exists, a plain canvas everywhere else —
  // this is the branch iOS Safari used to fall off.
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(source, 0, 0, width, height)
        const blob = await canvas.convertToBlob({ type: 'image/webp', quality })
        if (blob && (blob.type === 'image/webp' || blob.type === 'image/jpeg')) return blob
      }
    } catch {
      /* fall through to the DOM canvas */
    }
  }

  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, width, height)

  for (const type of ['image/webp', 'image/jpeg']) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), type, quality),
    )
    // A browser that cannot encode the type hands back PNG or null.
    if (blob && blob.type === type) return blob
  }
  return null
}

export async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  // Small enough to send as-is, and re-encoding could only make it worse.
  if (file.size < MIN_BYTES_TO_BOTHER && file.size < PHOTO_BUDGET) return file

  const source = await decode(file)
  if (!source) return file

  try {
    let best: Blob | null = null
    for (const attempt of RETRIES) {
      const blob = await encode(source, attempt.dimension, attempt.quality)
      if (!blob) break
      best = blob
      // Stop as soon as it fits — the later, smaller attempts exist for
      // photos that don't, not as a target for every upload.
      if (blob.size <= PHOTO_BUDGET) break
    }
    if (!best) return file

    // Re-encoding an already-efficient photo can make it bigger. Send
    // whichever is smaller — unless the original is over budget, in
    // which case the smaller one is the only one that can be sent at all.
    if (best.size >= file.size && file.size <= PHOTO_BUDGET) return file

    const ext = best.type === 'image/jpeg' ? '.jpg' : '.webp'
    return new File([best], file.name.replace(/\.[^.]+$/, '') + ext, {
      type: best.type,
      lastModified: file.lastModified,
    })
  } catch {
    return file
  } finally {
    if (!(source instanceof HTMLImageElement)) source.close()
  }
}
