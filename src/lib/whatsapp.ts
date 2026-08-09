/**
 * Talking back to WhatsApp.
 *
 * Every reply this app sends is a confirmation or a correction of
 * something a staff member just did to a shelf, so a send that quietly
 * fails is worse than useless: the counter believes an update landed that
 * never did. Nothing here throws into a request — the caller has already
 * written to the database by the time it sends — but every failure is
 * logged with Meta's own error body, which is the only place the real
 * reason ever appears.
 */

const GRAPH_VERSION = 'v19.0'

/**
 * Where the Graph API lives. Overridable so a staging environment — or a
 * test — can point the sends somewhere it can inspect them, rather than
 * the alternative of asserting on a mock and never once exercising the
 * request this actually builds.
 */
function graphBase(): string {
  return process.env.WHATSAPP_GRAPH_BASE ?? 'https://graph.facebook.com'
}

/** WhatsApp's own limits. Exceeding either is a 400 from Meta, not a truncation. */
const MAX_BUTTONS = 3
const MAX_BUTTON_TITLE = 20
const MAX_BODY = 1024

export type QuickReplyButton = {
  /** Comes back to the webhook as interactive.button_reply.id. */
  id: string
  title: string
}

type SendArgs = {
  /** Recipient in E.164 without the plus, as Meta returns it: 2348031234567. */
  to: string
  body: string
  buttons?: QuickReplyButton[]
}

function credentials() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) return null
  return { token, phoneNumberId }
}

/** True when the integration is configured enough to send anything at all. */
export function whatsappConfigured(): boolean {
  return credentials() !== null
}

/**
 * Trims a button title to what WhatsApp accepts.
 *
 * Titles carry drug names, which are routinely longer than twenty
 * characters, and Meta rejects the whole message rather than shortening
 * it — so one long name would silently cost the staff member their reply.
 */
export function buttonTitle(text: string): string {
  const clean = text.trim()
  return clean.length <= MAX_BUTTON_TITLE ? clean : `${clean.slice(0, MAX_BUTTON_TITLE - 1)}…`
}

/**
 * Sends a text reply, or a text with up to three quick-reply buttons.
 *
 * Returns whether it went out. Callers use that to decide what to log,
 * never to decide whether the database write stands — by this point it
 * already does.
 */
export async function sendWhatsAppMessage({ to, body, buttons }: SendArgs): Promise<boolean> {
  const creds = credentials()
  if (!creds) {
    console.error('[whatsapp] not configured — WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID')
    return false
  }

  const text = body.length > MAX_BODY ? `${body.slice(0, MAX_BODY - 1)}…` : body
  const trimmed = (buttons ?? []).slice(0, MAX_BUTTONS)

  const payload =
    trimmed.length > 0
      ? {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text },
            action: {
              buttons: trimmed.map((b) => ({
                type: 'reply',
                reply: { id: b.id, title: buttonTitle(b.title) },
              })),
            },
          },
        }
      : {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          // Link previews off: these are counter messages, not marketing,
          // and a preview card on a drug name is noise.
          text: { body: text, preview_url: false },
        }

  try {
    const res = await fetch(
      `${graphBase()}/${GRAPH_VERSION}/${creds.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    )
    if (!res.ok) {
      // Meta puts the actual reason in the body; the status alone is
      // almost always a bare 400.
      console.error('[whatsapp] send failed', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (e) {
    console.error('[whatsapp] send threw', e)
    return false
  }
}
