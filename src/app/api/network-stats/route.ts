import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * What the network actually is, right now, for the landing page.
 *
 * Every number here is counted from the database on the request. Nothing
 * is rounded up, padded, or carried over from a target — a healthcare
 * product that inflates its coverage is lying about the one thing a
 * patient is trusting it with, and "1,200+ outlets" printed over a
 * database holding forty is exactly that.
 *
 * The consequence is that early on these numbers are small. That is the
 * caller's problem to present honestly (see NetworkPulse, which leads
 * with live activity until the counts are worth quoting) — not this
 * route's problem to solve by inventing a bigger one.
 *
 * Public and identical for everyone, so it is cached at the edge for a
 * minute. Nothing here identifies a patient, and the freshest fact it
 * carries — when some pharmacy last confirmed stock — is not meaningfully
 * staler at sixty seconds.
 */
export async function GET() {
  const [pharmacies, states, drugs, latest] = await Promise.all([
    prisma.pharmacy.count({ where: { verificationStatus: 'APPROVED' } }),
    prisma.pharmacy.findMany({
      where: { verificationStatus: 'APPROVED' },
      distinct: ['state'],
      select: { state: true },
    }),
    prisma.drug.count(),
    // The most recent confirmation anywhere on the network. Approved
    // pharmacies only: an unapproved shop's activity is not the network's.
    prisma.pharmacyInventory.findFirst({
      where: { inStock: true, pharmacy: { verificationStatus: 'APPROVED' } },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true, pharmacy: { select: { lga: true, state: true } } },
    }),
  ])

  return NextResponse.json(
    {
      pharmacies,
      states: states.length,
      drugs,
      // Deliberately the area, never the pharmacy's name. A ticker naming
      // a shop broadcasts that shop's trading pattern to anyone watching
      // the home page, and the reassurance comes from the network being
      // alive, not from which counter it was.
      lastConfirmed: latest
        ? { at: latest.updatedAt, lga: latest.pharmacy.lga, state: latest.pharmacy.state }
        : null,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}
