// Swappable email adapter, same spirit as storage.ts: real delivery via
// Resend when RESEND_API_KEY is set, otherwise log the link so local dev
// keeps working without any provider configured.

const RESEND_API_URL = 'https://api.resend.com/emails'
const FROM_ADDRESS = process.env.RESEND_FROM ?? 'PharmaFinder <onboarding@resend.dev>'

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log(`[mail] RESEND_API_KEY not set — password reset link for ${to}: ${resetUrl}`)
    return
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject: 'Reset your PharmaFinder password',
      html: `
        <p>Someone requested a password reset for this email on PharmaFinder.</p>
        <p><a href="${resetUrl}">Click here to choose a new password</a> — this link expires in 1 hour.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[mail] Resend request failed (${res.status}): ${body}`)
  }
}
