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

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const TYPE_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export const ALLOWED_IMAGE_TYPES = Object.keys(EXT_BY_TYPE)
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

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

function buildStorage(): StorageAdapter {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const bucket = process.env.SUPABASE_STORAGE_BUCKET
  if (supabaseUrl && serviceRoleKey && bucket) {
    return new SupabaseStorage(supabaseUrl, serviceRoleKey, bucket)
  }
  return new LocalDiskStorage(process.env.UPLOADS_DIR ?? './storage/uploads')
}

export const storage: StorageAdapter = buildStorage()
