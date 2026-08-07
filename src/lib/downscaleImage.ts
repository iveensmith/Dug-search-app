/**
 * Shrinks a photo in the browser before it is uploaded.
 *
 * The server already re-encodes everything to WebP (lib/images.ts), so
 * this is not about what gets stored — it is about what has to travel.
 * A phone photo is several megabytes; on a 3G connection that is most of
 * a minute of uploading, on the patient's own data, before a pharmacist
 * sees anything. Sending roughly a megabyte instead is the difference
 * between a form that works on the road and one that times out.
 *
 * Entirely best-effort. Anything unexpected — an unusual format, a
 * browser without the APIs, a decode failure — returns the original file
 * and lets the server do the work. A prescription that uploads slowly is
 * a nuisance; one that fails to upload is a patient who doesn't get an
 * answer.
 */

/** Matches the server's cap, so neither side has to redo the other's work. */
const MAX_DIMENSION = 1600
const QUALITY = 0.82

/** Below this there is nothing worth doing. */
const MIN_BYTES_TO_BOTHER = 400 * 1024

function canDownscale(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof createImageBitmap === 'function' &&
    typeof OffscreenCanvas !== 'undefined'
  )
}

export async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.size < MIN_BYTES_TO_BOTHER) return file
  if (!canDownscale()) return file

  try {
    // imageOrientation: 'from-image' applies the EXIF rotation while
    // decoding. Without it a photo taken sideways would be re-encoded
    // sideways, and the tag that said so is lost in the process.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })

    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    // WebP is what the server stores anyway. A browser that can't encode
    // it throws or hands back a PNG, and both cases fall through below.
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: QUALITY })
    if (!blob || blob.type !== 'image/webp') return file

    // Re-encoding an already-small or already-efficient photo can make it
    // bigger. Send whichever is smaller.
    if (blob.size >= file.size) return file

    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', {
      type: 'image/webp',
      lastModified: file.lastModified,
    })
  } catch {
    return file
  }
}
