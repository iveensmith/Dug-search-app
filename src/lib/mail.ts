// Swappable email adapter, same spirit as storage.ts: real delivery via
// Resend when RESEND_API_KEY is set, otherwise log the content so local dev
// keeps working without any provider configured.

const RESEND_API_URL = 'https://api.resend.com/emails'
const FROM_ADDRESS = process.env.RESEND_FROM ?? 'MediQuest <onboarding@resend.dev>'

/**
 * Returns whether the message was actually handed over.
 *
 * It reports rather than throws, so the callers that genuinely do not
 * care — a reset mail must answer identically whether or not the address
 * exists — can go on ignoring it, while the ones that tell a person
 * "check your inbox" can find out first. Resend rejecting a message used
 * to be a line in a log and nothing else, which meant the app could
 * cheerfully send somebody to watch an inbox nothing was ever posted to.
 *
 * A missing API key counts as delivered: that is the local-dev path,
 * where the content goes to the console and nothing has failed.
 */
async function sendEmail(to: string, subject: string, html: string, fallbackLog: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log(`[mail] RESEND_API_KEY not set — ${fallbackLog}`)
    return true
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[mail] Resend request failed (${res.status}): ${body}`)
      return false
    }
    return true
  } catch (e) {
    // DNS, TLS, timeout — nothing left the building either way.
    console.error('[mail] Resend request threw:', e)
    return false
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  return sendEmail(
    to,
    'Reset your MediQuest password',
    `
      <p>Someone requested a password reset for this email on MediQuest.</p>
      <p><a href="${resetUrl}">Click here to choose a new password</a> — this link expires in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
    `password reset link for ${to}: ${resetUrl}`,
  )
}

/**
 * Proves an address belongs to whoever typed it. Says plainly that the
 * account works without it, because it does — see lib/emailVerification.
 */
export async function sendVerifyEmail(to: string, verifyUrl: string): Promise<boolean> {
  return sendEmail(
    to,
    'Confirm your email for MediQuest',
    `
      <p>Welcome to MediQuest.</p>
      <p><a href="${verifyUrl}">Confirm this email address</a> — the link works for 24 hours.</p>
      <p>You can keep using MediQuest either way; confirming just means we can
      reach you if a pharmacist replies or you ever need to reset your password.</p>
      <p>If you didn't create an account, you can ignore this email.</p>
    `,
    `verify link for ${to}: ${verifyUrl}`,
  )
}

/**
 * Tells someone their account stopped accepting sign-ins.
 *
 * This is the only place the lockout is ever mentioned. The sign-in form
 * deliberately cannot say it — telling the browser "locked" tells whoever
 * is guessing that they have found a real account. The person who owns
 * the address is the one who should hear about it, and this is the
 * channel only they can read.
 */
export async function sendAccountLockedEmail(
  to: string,
  minutes: number,
  resetUrl: string,
): Promise<boolean> {
  return sendEmail(
    to,
    'Your MediQuest account is temporarily locked',
    `
      <p>Someone tried to sign in to your MediQuest account several times
      with the wrong password, so we have stopped accepting sign-ins for
      the next ${minutes} minutes.</p>
      <p><strong>If this was you</strong> — wait ${minutes} minutes and try
      again, or <a href="${resetUrl}">set a new password now</a>. That link
      expires in 1 hour and unlocks the account straight away.</p>
      <p><strong>If this was not you</strong> — your password has not been
      changed and nobody has got in. Setting a new password is the safest
      next step, especially if you use that password anywhere else.</p>
    `,
    `account-locked notice for ${to} (${minutes} min): ${resetUrl}`,
  )
}

export async function sendStockAvailableEmail(to: string, drugLabel: string, pharmacyName: string): Promise<boolean> {
  return sendEmail(
    to,
    `${drugLabel} is now in stock nearby`,
    `
      <p><strong>${pharmacyName}</strong> just marked <strong>${drugLabel}</strong> as in stock.</p>
      <p>Search again on MediQuest to see current pharmacies and get directions.</p>
    `,
    `stock-available notice for ${to}: ${drugLabel} at ${pharmacyName}`,
  )
}

/**
 * Tells a pharmacy owner someone has asked them to hold stock. Without
 * this the request just sits in a dashboard nobody has open, and the
 * patient is waiting on a pharmacy that has no idea.
 */
export async function sendReservationRequestEmail(
  to: string,
  drugLabel: string,
  patientName: string,
  quantity: number | null,
  note: string | null,
  contactPhone: string | null,
): Promise<void> {
  const details = [
    quantity ? `<p>Quantity asked for: <strong>${quantity}</strong></p>` : '',
    contactPhone ? `<p>Callback number: <strong>${contactPhone}</strong></p>` : '',
    note ? `<p>Their note: “${note}”</p>` : '',
  ].join('')

  await sendEmail(
    to,
    `${patientName} asked you to hold ${drugLabel}`,
    `
      <p><strong>${patientName}</strong> has asked you to hold <strong>${drugLabel}</strong>.</p>
      ${details}
      <p>Open the Reservations tab in your MediQuest dashboard to set it aside,
      mark it collected, or decline if you can't hold it.</p>
      <p>Nothing has been paid and you are not committed to anything by this request.</p>
    `,
    `reservation request for ${to}: ${drugLabel} for ${patientName}`,
  )
}
