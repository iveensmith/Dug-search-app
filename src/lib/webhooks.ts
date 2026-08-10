import crypto from 'crypto'
import dns from 'dns/promises'
import net from 'net'
import { prisma } from './db'

/**
 * Telling a pharmacy's own software that something happened here.
 *
 * The one event worth this machinery is a reservation: a patient has left
 * the house expecting a medicine to be waiting. A dashboard nobody has
 * open cannot tell the counter that; a POS screen can.
 *
 * Three things shape everything below.
 *
 * 1. **The event is written before it is sent.** A row that exists but
 *    was never delivered can be retried. A send that was never recorded
 *    is simply gone, and "the pharmacy never heard" is the only failure
 *    that matters.
 *
 * 2. **A pharmacy's server must never be able to hurt a patient.** The
 *    reservation is committed before any of this runs, delivery is
 *    bounded by a short timeout, and every error is swallowed. A shop
 *    with a dead endpoint gets retries; the patient gets their
 *    reservation either way.
 *
 * 3. **The URL comes from a user.** That makes this an SSRF hazard by
 *    construction — a field where somebody types an address and our
 *    server fetches it. See assertPublicHttpsUrl.
 */

/** Bounded because a patient is waiting on the other end of this request. */
const INLINE_TIMEOUT_MS = 3_000

/** Nobody is waiting on a drain, so it can afford to be patient. */
const DRAIN_TIMEOUT_MS = 8_000

/**
 * Waits after each failed attempt. Six attempts over about eight hours,
 * then we stop: a reservation nobody collected in a working day is not
 * news any more, and retrying forever only fills a table.
 */
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3600_000, 6 * 3600_000]
export const MAX_ATTEMPTS = BACKOFF_MS.length + 1

/** How many past attempts an owner can see. */
export const RECENT_DELIVERIES = 20

/* --------------------------------------------------------------- the URL */

/**
 * Refuses anything that is not a public HTTPS address.
 *
 * A pharmacy owner types this in, and our server then fetches it — which
 * is a request originating inside our infrastructure, holding whatever
 * network position that gives. Left unchecked, "http://169.254.169.254/"
 * is a cloud metadata endpoint and "http://10.0.0.5:6379" is somebody
 * else's Redis. So: HTTPS only, and every address the name resolves to
 * has to be a public one.
 *
 * This is not airtight. A name that passes here can resolve to something
 * private a second later (DNS rebinding); closing that needs the check to
 * happen against the socket's actual peer, which fetch does not expose.
 * What it does buy is that the obvious targets — loopback, link-local,
 * RFC1918 — cannot simply be typed into the box. Redirects are not
 * followed, so a public URL cannot bounce us somewhere private either.
 */
export async function assertPublicHttpsUrl(raw: string): Promise<void> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('That is not a valid URL.')
  }

  const allowInsecure = process.env.WEBHOOK_ALLOW_INSECURE === '1'
  if (url.protocol !== 'https:' && !allowInsecure) {
    throw new Error('The URL must start with https:// — events carry patient details.')
  }
  if (url.username || url.password) {
    throw new Error('Put credentials in a header your server checks, not in the URL.')
  }

  const addresses = net.isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await dns.lookup(url.hostname, { all: true }).catch(() => {
        throw new Error('That address does not resolve. Check the hostname.')
      })

  if (addresses.length === 0) throw new Error('That address does not resolve.')
  for (const { address } of addresses) {
    if (!allowInsecure && !isPublicAddress(address)) {
      throw new Error('That address is not reachable from the public internet.')
    }
  }
}

function isPublicAddress(address: string): boolean {
  if (net.isIPv4(address)) return isPublicIPv4(address)
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase()
    if (lower === '::1' || lower === '::') return false
    // Unique-local (fc00::/7) and link-local (fe80::/10).
    if (/^f[cd]/.test(lower) || /^fe[89ab]/.test(lower)) return false
    // ::ffff:10.0.0.1 — an IPv4 address wearing an IPv6 coat.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPublicIPv4(mapped[1])
    return true
  }
  return false
}

function isPublicIPv4(address: string): boolean {
  const p = address.split('.').map(Number)
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b] = p
  if (a === 0 || a === 10 || a === 127) return false // this network, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return false // carrier-grade NAT
  if (a === 169 && b === 254) return false // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false // private
  if (a === 192 && b === 168) return false // private
  if (a === 192 && b === 0) return false // protocol assignments / TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return false // benchmarking
  if (a === 198 && b === 51) return false // TEST-NET-2
  if (a === 203 && b === 0) return false // TEST-NET-3
  if (a >= 224) return false // multicast and reserved
  return true
}

/* ------------------------------------------------------------- signatures */

export function newSecret(): string {
  return 'whsec_' + crypto.randomBytes(24).toString('hex')
}

/**
 * The signature a receiver checks.
 *
 * Signed over `timestamp.body` rather than the body alone, so a captured
 * request cannot be replayed at leisure — the receiver rejects an old
 * timestamp, and the timestamp is inside what was signed, so it cannot be
 * edited without breaking the signature.
 */
export function signBody(secret: string, timestamp: number, body: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

export function signatureHeader(secret: string, timestamp: number, body: string): string {
  return `t=${timestamp},v1=${signBody(secret, timestamp, body)}`
}

/* ---------------------------------------------------------------- queueing */

/**
 * Records an event for a pharmacy, if that pharmacy wants events.
 *
 * Returns the delivery id, or null when there is no active endpoint —
 * which is the common case, and deliberately costs one indexed lookup and
 * nothing else.
 */
export async function enqueueEvent(
  pharmacyId: string,
  event: string,
  data: unknown,
): Promise<string | null> {
  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { pharmacyId },
    select: { id: true, active: true },
  })
  if (!endpoint || !endpoint.active) return null

  const delivery = await prisma.webhookDelivery.create({
    data: {
      endpointId: endpoint.id,
      event,
      // Serialised once, here, and never again: the receiver's signature
      // is over these exact bytes, and re-encoding could reorder keys.
      payload: JSON.stringify({ event, createdAt: new Date().toISOString(), data }),
    },
    select: { id: true },
  })
  return delivery.id
}

/* --------------------------------------------------------------- delivery */

type AttemptResult = { ok: boolean; status?: number; error?: string }

async function post(url: string, secret: string, body: string, deliveryId: string, event: string, timeoutMs: number): Promise<AttemptResult> {
  const timestamp = Math.floor(Date.now() / 1000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MediQuest-Webhook/1',
        'X-MediQuest-Event': event,
        // Stable across retries, so a receiver can recognise one it has
        // already acted on. Retries are the normal case here, not an edge.
        'X-MediQuest-Delivery': deliveryId,
        'X-MediQuest-Signature': signatureHeader(secret, timestamp, body),
      },
      body,
      // A public URL must not be able to bounce us onto a private one.
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status }
    return { ok: false, status: res.status, error: `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : 'request failed' }
  }
}

/**
 * Tries one queued delivery and records what happened.
 *
 * Never throws. Every caller is in the middle of doing something that
 * matters more than this.
 */
export async function attemptDelivery(deliveryId: string, timeoutMs = DRAIN_TIMEOUT_MS): Promise<boolean> {
  try {
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        event: true,
        payload: true,
        attempts: true,
        deliveredAt: true,
        endpoint: { select: { id: true, url: true, secret: true, active: true } },
      },
    })
    if (!delivery || delivery.deliveredAt || !delivery.endpoint.active) return false

    const result = await post(
      delivery.endpoint.url,
      delivery.endpoint.secret,
      delivery.payload,
      delivery.id,
      delivery.event,
      timeoutMs,
    )
    const attempts = delivery.attempts + 1

    if (result.ok) {
      await prisma.$transaction([
        prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { attempts, deliveredAt: new Date(), lastStatus: result.status ?? 200, lastError: null },
        }),
        prisma.webhookEndpoint.update({
          where: { id: delivery.endpoint.id },
          data: { lastOkAt: new Date() },
        }),
      ])
      return true
    }

    const backoff = BACKOFF_MS[attempts - 1]
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        attempts,
        lastStatus: result.status ?? null,
        lastError: result.error ?? null,
        // Out of attempts: keep the row, because "this event was lost" is
        // something the owner needs to be able to see.
        ...(backoff === undefined
          ? { failedAt: new Date() }
          : { nextAttemptAt: new Date(Date.now() + backoff) }),
      },
    })
    return false
  } catch (e) {
    console.error('[webhook] attempt failed:', e)
    return false
  }
}

/**
 * Queues an event and tries it straight away.
 *
 * Awaited rather than detached, for the reason the reservation email
 * documents: on Vercel a detached promise can be killed the moment the
 * response is sent. The timeout is what keeps that honest — a dead
 * endpoint costs the patient three seconds, once, on a reservation that
 * has already been saved.
 */
export async function emitEvent(pharmacyId: string, event: string, data: unknown): Promise<void> {
  try {
    const id = await enqueueEvent(pharmacyId, event, data)
    if (id) await attemptDelivery(id, INLINE_TIMEOUT_MS)
  } catch (e) {
    console.error('[webhook] emit failed:', e)
  }
}

/**
 * Sends whatever is due.
 *
 * There is no scheduler in this deployment (DEPLOY.md), so this is called
 * two ways: from a protected endpoint something external can poke, and
 * opportunistically from ordinary requests. Neither alone is a guarantee,
 * and the docs say so rather than implying a delivery SLA we cannot keep.
 */
export async function drainDue(limit = 20): Promise<{ attempted: number; delivered: number }> {
  const due = await prisma.webhookDelivery.findMany({
    where: { deliveredAt: null, failedAt: null, nextAttemptAt: { lte: new Date() } },
    select: { id: true },
    orderBy: { nextAttemptAt: 'asc' },
    take: limit,
  })

  let delivered = 0
  // Sequential: a burst of parallel fetches from a serverless function is
  // how one struggling receiver becomes our problem too.
  for (const d of due) if (await attemptDelivery(d.id)) delivered++
  return { attempted: due.length, delivered }
}

/**
 * Drains on an ordinary request, now and then.
 *
 * Same trick as pruneOccasionally in lib/loginThrottle, and the same
 * reasoning: without a scheduler, real traffic is the only clock there
 * is. Small and capped so it cannot become the reason a page is slow.
 */
export async function drainOccasionally(): Promise<void> {
  if (Math.random() > 0.05) return
  try {
    await drainDue(3)
  } catch {
    // Never the caller's problem.
  }
}
