import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

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

export const storage: StorageAdapter = new LocalDiskStorage(
  process.env.UPLOADS_DIR ?? './storage/uploads',
)
