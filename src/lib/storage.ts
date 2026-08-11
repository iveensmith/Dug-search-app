import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

/**
 * File storage behind an interface so local disk can be swapped for
 * S3-compatible storage later without touching upload/serve code paths.
 * The database stores only the `key` returned by put().
 */
export interface StorageAdapter {
  put(data: Buffer, contentType: string): Promise<string> // returns key
  get(key: string): Promise<{ data: Buffer; contentType: string } | null>
  delete(key: string): Promise<void>
}

// The extension is derived from the content type on the way in and the
// content type from the extension on the way out, so these two must stay
// exact mirrors of each other or a stored file becomes unreadable.
const IMAGE_EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
// Voice notes on prescription queries — see lib/audioNotes. Stored exactly
// as the browser recorded them: there is no re-encoding step for audio the
// way there is for photos, because every format here is already
// speech-sized and transcoding would need a binary this app doesn't carry.
const AUDIO_EXT_BY_TYPE: Record<string, string> = {
  'audio/webm': 'weba',
  'audio/mp4': 'm4a',
  'audio/ogg': 'oga',
  'audio/mpeg': 'mp3',
}

const EXT_BY_TYPE: Record<string, string> = { ...IMAGE_EXT_BY_TYPE, ...AUDIO_EXT_BY_TYPE }
const TYPE_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(EXT_BY_TYPE).map(([type, ext]) => [ext, type]),
)

export const ALLOWED_IMAGE_TYPES = Object.keys(IMAGE_EXT_BY_TYPE)
// Generous because nothing is stored at this size: uploads are re-encoded
// to WebP at 1600px before they hit storage (see lib/images.ts), so a
// 20 MB phone photo lands as well under a megabyte. The cap is here to
// stop something absurd being pushed through the decoder, not to keep
// storage down.
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20 MB

class LocalDiskStorage implements StorageAdapter {
  constructor(private baseDir: string) {}

  private resolveSafe(key: string): string {
    const full = path.resolve(this.baseDir, key)
    if (!full.startsWith(path.resolve(this.baseDir))) {
      throw new Error('Invalid storage key')
    }
    return full
  }

  async put(data: Buffer, contentType: string): Promise<string> {
    const ext = EXT_BY_TYPE[contentType]
    if (!ext) throw new Error(`Unsupported content type: ${contentType}`)
    const key = `prescriptions/${crypto.randomUUID()}.${ext}`
    const full = this.resolveSafe(key)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, data)
    return key
  }

  async get(key: string) {
    const ext = key.split('.').pop() ?? ''
    const contentType = TYPE_BY_EXT[ext]
    if (!contentType) return null
    try {
      const data = await fs.readFile(this.resolveSafe(key))
      return { data, contentType }
    } catch {
      return null
    }
  }

  async delete(key: string) {
    try {
      await fs.unlink(this.resolveSafe(key))
    } catch {
      /* already gone */
    }
  }
}

/**
 * Supabase Storage (S3-compatible under the hood). Used in production
 * where the filesystem is serverless/ephemeral (e.g. Vercel) and local
 * disk can't survive between requests. The bucket must be PRIVATE —
 * access control is enforced entirely by our API route, not by Storage.
 */
class SupabaseStorage implements StorageAdapter {
  private client: ReturnType<typeof createClient>

  constructor(
    url: string,
    serviceRoleKey: string,
    private bucket: string,
  ) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    })
  }

  async put(data: Buffer, contentType: string): Promise<string> {
    const ext = EXT_BY_TYPE[contentType]
    if (!ext) throw new Error(`Unsupported content type: ${contentType}`)
    const key = `prescriptions/${crypto.randomUUID()}.${ext}`
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(key, data, { contentType, upsert: false })
    if (error) throw new Error(`Storage upload failed: ${error.message}`)
    return key
  }

  async get(key: string) {
    const ext = key.split('.').pop() ?? ''
    const contentType = TYPE_BY_EXT[ext]
    if (!contentType) return null
    const { data, error } = await this.client.storage.from(this.bucket).download(key)
    if (error || !data) return null
    return { data: Buffer.from(await data.arrayBuffer()), contentType }
  }

  async delete(key: string) {
    await this.client.storage.from(this.bucket).remove([key])
  }
}

/**
 * Which adapter is live, and why — for the diagnostics endpoint.
 *
 * `missing` names the Supabase variables that are absent. On a serverless
 * host that list is the whole explanation for a failing upload: the
 * fallback writes to the project directory, which is read-only
 * everywhere except /tmp, so every single put throws EROFS. That used to
 * be indistinguishable from a bucket problem, because both surfaced as
 * the same 502 with the same sentence for the patient.
 */
export type StorageInfo = {
  kind: 'supabase' | 'disk'
  bucket?: string
  dir?: string
  missing: string[]
  serverless: boolean
  /** The project origin actually used, once corrected. Not a secret — it is
   *  the same URL a browser-side Supabase client would ship publicly. */
  url?: string
  /** What had to be trimmed off SUPABASE_URL, if anything. */
  corrected?: string
}

const SUPABASE_VARS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET'] as const

/**
 * The project URL, and only the project URL.
 *
 * supabase-js appends `/storage/v1/object/...` itself, so anything already
 * carrying a path doubles it and the API answers "Invalid path specified
 * in request URL" — a message that says nothing about where it came from.
 * The Supabase dashboard offers several URLs for one project and only the
 * bare origin is the right one here; the S3 connection endpoint
 * (`…/storage/v1/s3`) is the easiest of the others to pick up by mistake.
 *
 * So the two unambiguous wrong shapes are corrected rather than passed
 * through: a trailing storage path, which this client would never want,
 * and repeated trailing slashes, which produce a doubled leading slash.
 */
export function normaliseSupabaseUrl(raw: string): { url: string; corrected?: string } {
  const trimmed = raw.trim().replace(/\/+$/, '')
  const withoutStorage = trimmed.replace(/\/storage\/v1(\/s3)?$/, '')
  const url = withoutStorage.replace(/\/+$/, '')
  if (url === raw) return { url }
  return { url, corrected: `"${raw}" → "${url}"` }
}

export const storageInfo: StorageInfo = (() => {
  const missing = SUPABASE_VARS.filter((v) => !process.env[v])
  // Vercel sets VERCEL=1 on every deployment, including previews.
  const serverless = !!process.env.VERCEL
  if (missing.length === 0) {
    const { url, corrected } = normaliseSupabaseUrl(process.env.SUPABASE_URL!)
    return {
      kind: 'supabase',
      bucket: process.env.SUPABASE_STORAGE_BUCKET!.trim(),
      missing,
      serverless,
      url,
      corrected,
    }
  }
  return { kind: 'disk', dir: process.env.UPLOADS_DIR ?? './storage/uploads', missing, serverless }
})()

function buildStorage(): StorageAdapter {
  if (storageInfo.kind === 'supabase') {
    if (storageInfo.corrected) {
      console.warn(`[storage] SUPABASE_URL carried a path or trailing slash: ${storageInfo.corrected}`)
    }
    return new SupabaseStorage(
      storageInfo.url!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
      storageInfo.bucket!,
    )
  }
  if (storageInfo.serverless) {
    // Said once, at startup, where it is findable — rather than only as a
    // per-request stack trace after a patient has already lost a photo.
    console.error(
      `[storage] No bucket configured (missing ${storageInfo.missing.join(', ')}). ` +
        'Falling back to local disk, which is read-only on this host — every upload will fail.',
    )
  }
  return new LocalDiskStorage(storageInfo.dir!)
}

export const storage: StorageAdapter = buildStorage()

/**
 * Proves the configured storage actually works, by writing a small object,
 * reading it back and deleting it. Returns the raw error, because the
 * whole point is to see the message the upload path swallows.
 */
export async function selfTest(): Promise<{ ok: boolean; step: string; error?: string }> {
  let key: string | null = null
  try {
    key = await storage.put(Buffer.from('mediquest storage check'), 'image/webp')
  } catch (e) {
    return { ok: false, step: 'write', error: e instanceof Error ? e.message : String(e) }
  }
  try {
    const got = await storage.get(key)
    if (!got) return { ok: false, step: 'read', error: 'stored object could not be read back' }
  } catch (e) {
    return { ok: false, step: 'read', error: e instanceof Error ? e.message : String(e) }
  } finally {
    await storage.delete(key).catch(() => {})
  }
  return { ok: true, step: 'done' }
}
