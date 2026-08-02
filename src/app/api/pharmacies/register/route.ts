import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { normalizePhone, requireSession, setSessionCookie, signSession } from '@/lib/auth'
import { isValidState } from '@/lib/states'
import { Prisma } from '@/generated/prisma/client'

const bodySchema = z.object({
  pharmacyName: z.string().min(2).max(120),
  address: z.string().min(5).max(300),
  state: z.string().refine(isValidState, { message: 'Select a valid state' }),
  phone: z.string().min(7).max(20),
  pcnLicenseNumber: z.string().min(3).max(60),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

// Registering an outlet requires being signed in — the pharmacy is attached
// to the caller's account. A non-owner account (e.g. a patient) gets a
// sibling PHARMACY_OWNER account sharing its email/phone/password (one
// account per role, same identifier — see the User model), and the session
// is re-signed as that owner account so the dashboard works immediately.
export async function POST(req: NextRequest) {
  const session = await requireSession(req)
  if (session instanceof NextResponse) return session

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { error: `${issue.path.join('.')}: ${issue.message}` },
      { status: 400 },
    )
  }
  const data = parsed.data

  const caller = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!caller) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  try {
    const { owner } = await prisma.$transaction(async (tx) => {
      // Resolve the owner account: the caller if they're already a
      // pharmacy owner, else their existing or newly created owner-role
      // sibling account.
      let owner = caller
      if (caller.role !== 'PHARMACY_OWNER') {
        const sibling = caller.email
          ? await tx.user.findUnique({
              where: { email_role: { email: caller.email, role: 'PHARMACY_OWNER' } },
            })
          : null
        owner =
          sibling ??
          (await tx.user.create({
            data: {
              email: caller.email,
              phone: caller.phone,
              passwordHash: caller.passwordHash, // same password as the account they're signed in with
              displayName: caller.displayName ?? `${data.pharmacyName} Owner`,
              role: 'PHARMACY_OWNER',
              state: caller.state,
            },
          }))
      }

      const existing = await tx.pharmacy.findUnique({ where: { ownerUserId: owner.id } })
      if (existing) throw new AlreadyOwnsPharmacyError()

      await tx.pharmacy.create({
        data: {
          name: data.pharmacyName,
          address: data.address,
          state: data.state,
          phone: normalizePhone(data.phone),
          pcnLicenseNumber: data.pcnLicenseNumber.trim().toUpperCase(),
          latitude: data.latitude,
          longitude: data.longitude,
          verificationStatus: 'PENDING',
          ownerUserId: owner.id,
        },
      })
      return { owner }
    })

    const res = NextResponse.json({ ok: true }, { status: 201 })
    setSessionCookie(res, await signSession({ userId: owner.id, role: owner.role }))
    return res
  } catch (e) {
    if (e instanceof AlreadyOwnsPharmacyError) {
      return NextResponse.json(
        { error: 'This account already has a pharmacy outlet — each account can manage one.' },
        { status: 409 },
      )
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const target = String(e.meta?.target ?? '')
      const friendly = target.includes('pcn')
        ? 'A pharmacy with that PCN license number is already registered'
        : 'That pharmacy is already registered'
      return NextResponse.json({ error: friendly }, { status: 409 })
    }
    throw e
  }
}

class AlreadyOwnsPharmacyError extends Error {}
