import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { selfTest, storageInfo } from '@/lib/storage'

/**
 * Is file storage actually working?
 *
 * Every upload failure looks the same from the outside — "We could not
 * store your photo just now" covers an unset environment variable, a
 * bucket that does not exist, a bucket that refuses WebP, and a bad
 * service-role key alike. The real message goes to the server log, which
 * is not where the person trying to fix it is looking.
 *
 * This writes a small object, reads it back, deletes it, and reports what
 * happened. Admin-only: it names the bucket and returns the raw provider
 * error, neither of which belongs in a patient's browser.
 */
export async function GET(req: NextRequest) {
  const session = await requireSession(req, ['ADMIN'])
  if (session instanceof NextResponse) return session

  const result = await selfTest()

  // The single most common cause, and the one worth naming outright: no
  // bucket configured on a host whose disk is read-only.
  const diagnosis =
    result.ok
      ? 'Storage is working.'
      : storageInfo.kind === 'disk' && storageInfo.serverless
        ? `No bucket is configured — ${storageInfo.missing.join(', ')} ${
            storageInfo.missing.length === 1 ? 'is' : 'are'
          } not set on this deployment, so uploads are being written to a read-only disk. Set them in your hosting environment and redeploy.`
        : storageInfo.kind === 'disk'
          ? `Writing to local disk at ${storageInfo.dir}, and that write failed.`
          : `The bucket "${storageInfo.bucket}" rejected the ${result.step}. If the message mentions mime or content type, add image/webp and the audio types to the bucket's allowed list.`

  return NextResponse.json({
    storage: storageInfo,
    check: result,
    diagnosis,
  })
}
