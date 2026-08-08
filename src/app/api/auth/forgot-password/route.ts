import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { normalizePhone } from '@/lib/auth'
import { sendPasswordResetEmail } from '@/lib/mail'
import { issueResetUrl } from '@/lib/passwordReset'
import { INVALID_INPUT_MESSAGE } from '@/lib/authValidation'

const bodySchema = z.object({ identifier: z.string().min(3).max(200) })

// Always responds { ok: true } regardless of whether the account exists (or
// has an email on file) — avoids leaking which identifiers are registered.
//
// Email/phone are only unique per-role, so the same identifier can match
// more than one account (e.g. a patient account and a pharmacy-owner
// account) — reset every matching account and email each one separately.
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    // Same generic reply as the other auth routes. Everything past this
    // point already answers { ok: true } whether or not the account
    // exists, so this is the only line that could have said otherwise.
    return NextResponse.json({ error: INVALID_INPUT_MESSAGE }, { status: 400 })
  }

  const id = parsed.data.identifier.trim()
  const users = await prisma.user.findMany({
    where: id.includes('@') ? { email: id.toLowerCase() } : { phone: normalizePhone(id) },
  })

  for (const user of users) {
    if (!user.email) continue
    await sendPasswordResetEmail(user.email, await issueResetUrl(user.id, req.nextUrl.origin))
  }

  return NextResponse.json({ ok: true })
}
