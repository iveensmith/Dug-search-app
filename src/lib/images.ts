import sharp from 'sharp'

/**
 * Prescription photos are the only real images this app moves, and they
 * arrive straight off a phone camera: ten megabytes, four thousand pixels
 * wide, far more than anyone needs to read a prescription. They used to be
 * stored exactly as sent and served back the same way — to the pharmacist
 * once, and to the patient every time either of them opened the thread. On
 * a metered Nigerian mobile connection that is the most expensive thing
 * the app does.
 *
 * Everything is normalised to WebP on the way in. JPEG is produced on the
 * way out only for the rare browser that says it cannot take WebP.
 */

/** Enough to read a prescription; a phone camera gives 3–4× more. */
const MAX_DIMENSION = 1600

const WEBP_QUALITY = 82
const JPEG_QUALITY = 82

export const STORED_IMAGE_TYPE = 'image/webp'

/**
 * Normalises an uploaded photo for storage.
 *
 * `rotate()` with no argument applies the EXIF orientation and then drops
 * it. Phone cameras record "this was taken sideways" as a tag rather than
 * by rotating the pixels, and re-encoding without honouring it would hand
 * the pharmacist a prescription lying on its side.
 *
 * sharp drops metadata unless asked to keep it, which is what we want for
 * a second reason: phone photos carry GPS coordinates, and a prescription
 * photo taken at home would otherwise arrive at a stranger's screen with
 * the patient's address attached.
 */
export async function normaliseUpload(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()
}

/** Fallback for clients that don't advertise WebP support. */
export async function toJpeg(input: Buffer): Promise<Buffer> {
  return sharp(input).jpeg({ quality: JPEG_QUALITY }).toBuffer()
}

/** Whether the caller's Accept header says it can display WebP. */
export function acceptsWebp(accept: string | null): boolean {
  if (!accept) return false
  return accept.includes('image/webp') || accept.includes('*/*')
}
