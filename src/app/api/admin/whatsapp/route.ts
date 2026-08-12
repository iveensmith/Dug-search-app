import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

/**
 * Is the WhatsApp integration actually wired up?
 *
 * Setting this channel up is six steps across two Meta consoles, and the
 * failure modes all look identical from the app's side: nothing arrives.
 * A wrong phone number ID, an expired 24-hour test token, a webhook
 * pointed at the wrong URL and a verify token that does not match all
 * present as silence.
 *
 * So this asks Meta directly. It reads the phone number back through the
 * Graph API with the configured credentials, which is the one call that
 * proves the token and the ID belong together and are both live. It also
 * prints the callback URL and shows whether the verify token is set, so
 * the two values that have to be typed into Meta's console can be copied
 * from here rather than reconstructed.
 *
 * Admin-only: it names the business phone number and returns raw Meta
 * errors, and `?to=` sends a real message.
 */

const GRAPH_VERSION = 'v19.0'

function graphBase(): string {
  return process.env.WHATSAPP_GRAPH_BASE ?? 'https://graph.facebook.com'
}

export async function GET(req: NextRequest) {
  const session = await requireSession(req, ['ADMIN'])
  if (session instanceof NextResponse) return session

  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
  const appSecret = process.env.WHATSAPP_APP_SECRET

  const missing = [
    !token && 'WHATSAPP_ACCESS_TOKEN',
    !phoneNumberId && 'WHATSAPP_PHONE_NUMBER_ID',
    !verifyToken && 'WHATSAPP_VERIFY_TOKEN',
    !appSecret && 'WHATSAPP_APP_SECRET',
  ].filter(Boolean) as string[]

  // The two values Meta's console asks for. Derived from the request so
  // they are right for whichever deployment this is being read on.
  const origin = req.nextUrl.origin
  const setup = {
    callbackUrl: `${origin}/api/webhooks/whatsapp`,
    verifyTokenSet: !!verifyToken,
    subscribeTo: 'messages',
  }

  if (missing.length) {
    return NextResponse.json({
      configured: false,
      missing,
      setup,
      diagnosis:
        `Not configured yet — ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} unset. ` +
        'Set them in the hosting environment and redeploy; env changes do not reach a running deployment.',
    })
  }

  // The call that proves token and ID belong together. A wrong ID gives
  // 404, an expired or wrong-scoped token gives 401/403 — and Meta says
  // which, where the app itself could only report silence.
  let live: { ok: boolean; status?: number; body?: unknown; error?: string }
  try {
    const res = await fetch(`${graphBase()}/${GRAPH_VERSION}/${phoneNumberId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    })
    const body = await res.json().catch(() => null)
    live = { ok: res.ok, status: res.status, body }
  } catch (e) {
    live = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  // ?to=2348031234567 sends a real message, so the last mile can be
  // proved rather than assumed. Deliberately opt-in.
  const to = req.nextUrl.searchParams.get('to')?.replace(/[^0-9]/g, '')
  let sent: boolean | null = null
  if (to) {
    sent = await sendWhatsAppMessage({
      to,
      body: 'MediQuest test message — if you can read this, the WhatsApp integration is working.',
    })
  }

  const diagnosis = live.ok
    ? sent === null
      ? 'Credentials work. Add ?to=234… to send a real test message.'
      : sent
        ? 'Credentials work and a test message was handed to Meta. If it does not arrive, the recipient has not messaged this number in the last 24 hours — outside that window only approved templates deliver.'
        : 'Credentials work but the test message was rejected. The server log has Meta’s reason, tagged [whatsapp].'
    : live.status === 404
      ? 'WHATSAPP_PHONE_NUMBER_ID is not a phone number this token can see. It is the Phone number ID from the WhatsApp > API Setup panel, not the phone number itself.'
      : live.status === 401 || live.status === 403
        ? 'The access token was refused. A 24-hour test token expires; use a permanent System User token with whatsapp_business_messaging.'
        : 'Could not reach the Graph API. See `live` below for what it said.'

  return NextResponse.json({ configured: true, setup, live, testMessageSent: sent, diagnosis })
}
