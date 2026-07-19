// Swappable email adapter, same spirit as storage.ts: real delivery via
// Resend when RESEND_API_KEY is set, otherwise log the content so local dev
// keeps working without any provider configured.

const RESEND_API_URL = 'https://api.resend.com/emails'
const FROM_ADDRESS = process.env.RESEND_FROM ?? 'PharmaFinder <onboarding@resend.dev>'

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
    'Reset your PharmaFinder password',
    `
      <p>Someone requested a password reset for this email on PharmaFinder.</p>
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
      <p>Search again on PharmaFinder to see current pharmacies and get directions.</p>
    `,
    `stock-available notice for ${to}: ${drugLabel} at ${pharmacyName}`,
  )
}
