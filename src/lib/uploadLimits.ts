/**
 * What a request body can actually weigh, and how to report it when it
 * cannot.
 *
 * The app's own cap was 20 MB (MAX_UPLOAD_BYTES in lib/storage), but a
 * serverless request body on Vercel is rejected at roughly 4.5 MB before
 * the handler ever runs. So the app was promising to accept photos the
 * platform would refuse, and refusing them with a platform error page
 * rather than one of ours — which the client then tried to parse as JSON.
 */

/**
 * Under the platform's ~4.5 MB, with room for multipart boundaries, the
 * text fields and the voice note travelling alongside the photo.
 */
export const MAX_REQUEST_BYTES = 4 * 1024 * 1024

/**
 * Turns a failed response into something true.
 *
 * The old code did `await res.json()` before checking `res.ok`, so any
 * response that was not JSON — a 413 from the edge, a 502, a timeout
 * page — threw at the parse and fell into a catch that blamed the
 * patient's network. On a good connection that is simply a lie, and it
 * sends them off to fight their signal instead of shrinking a photo.
 */
export async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  // Never reaches our handler, so there is never a JSON body to read.
  if (res.status === 413) {
    return 'That photo is too large to send. Try taking it again, or use a smaller one.'
  }
  try {
    const data = await res.json()
    if (data && typeof data.error === 'string') return data.error
  } catch {
    /* not JSON — fall through to the status-based wording */
  }
  if (res.status >= 500) {
    return `Something went wrong on our side (${res.status}). Please try again in a moment.`
  }
  return fallback
}
