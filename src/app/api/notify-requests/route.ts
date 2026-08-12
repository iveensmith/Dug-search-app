import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { isValidState } from '@/lib/states'
import { getSession } from '@/lib/auth'
import { consumeWindow } from '@/lib/rateLimit'
import { clientIp } from '@/lib/loginThrottle'

const bodySchema = z.object({
  drugId: z.string().min(1),
  state: z.string().refine(isValidState, { message: 'Unknown state' }),
  // Only read when nobody is signed in. A signed-in patient's address
  // comes from their account, never from what the browser sent.
  email: z.string().email().max(200).optional(),
})

/**
 * "Tell me when this medicine is back", captured on a zero-result search.
 *
 * Deliberately available to a signed-out visitor: somebody who cannot find
 * their medicine is the person this is for, and making them register first
 * would lose most of them. That openness is also the problem, because the
 * address submitted here is one this server will later send mail to.
 *
 * Taking the browser's word for it meant anyone could subscribe any
 * address, to any medicine, as often as they liked — and every time a
 * pharmacy marked that drug in stock, this app would email a stranger who
 * never asked. That is a spam cannon with someone else's return address on
 * it, and it costs the domain's deliverability.
 *
 * Two changes, and neither closes the door on the anonymous case:
 *
 *  - Signed in, the address is read from the account. The `email` field in
 *    the body is ignored entirely, so a session cannot be used to point
 *    notifications at somebody else.
 *  - Signed out, the submitted address is still accepted, but the rate is
 *    capped per address so one machine cannot enrol a list.
 */

// Generous for a person — nobody legitimately subscribes to ten medicines
// in an hour from one connection — and useless for a mailing run.
const MAX_PER_IP = 10
const WINDOW_MS = 60 * 60 * 1000

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 })
  }
  const { drugId, state } = parsed.data

  // Identity from the cookie, which is signed, rather than from the body,
  // which is whatever the client typed.
  const session = await getSession(req)
  let email: string

  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    })
    if (!user?.email) {
      return NextResponse.json(
        { error: 'Add an email address to your account first' },
        { status: 400 },
      )
    }
    email = user.email
  } else {
    if (!parsed.data.email) {
      return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 })
    }
    // Only the anonymous path is metered. A signed-in patient has already
    // proved the address is theirs, and throttling them would just break
    // somebody adding a few medicines in one sitting.
    const verdict = await consumeWindow(`notify:${clientIp(req)}`, MAX_PER_IP, WINDOW_MS)
    if (!verdict.allowed) {
      return NextResponse.json(
        { error: 'Too many requests from here — try again later, or sign in' },
        { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds) } },
      )
    }
    email = parsed.data.email
  }

  const drug = await prisma.drug.findUnique({ where: { id: drugId } })
  if (!drug) return NextResponse.json({ error: 'Unknown drug' }, { status: 404 })

  // Upsert on the (drugId, state, email) unique key so re-submitting
  // doesn't create duplicates or re-arm an already-notified request.
  await prisma.stockNotifyRequest.upsert({
    where: { drugId_state_email: { drugId, state, email: email.toLowerCase() } },
    create: { drugId, state, email: email.toLowerCase() },
    update: {},
  })

  return NextResponse.json({ ok: true })
}
