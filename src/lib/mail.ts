// Swappable email adapter, same spirit as storage.ts: real delivery via
// Resend when RESEND_API_KEY is set, otherwise log the content so local dev
// keeps working without any provider configured.

const RESEND_API_URL = 'https://api.resend.com/emails'
const FROM_ADDRESS = process.env.RESEND_FROM ?? 'MediQuest <onboarding@resend.dev>'

async function sendEmail(to: string, subject: string, html: string, fallbackLog: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log(`[mail] RESEND_API_KEY not set — ${fallbackLog}`)
    return
  }

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
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendEmail(
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

export async function sendStockAvailableEmail(to: string, drugLabel: string, pharmacyName: string): Promise<void> {
  await sendEmail(
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
