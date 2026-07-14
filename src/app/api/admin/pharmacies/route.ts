import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

// All pharmacies with owner contact, pending first
export async function GET(req: NextRequest) {
  const session = await requireSession(req, ['ADMIN'])
  if (session instanceof NextResponse) return session

  const pharmacies = await prisma.pharmacy.findMany({
    include: {
      owner: { select: { email: true, phone: true } },
      _count: { select: { inventory: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
  })

  return NextResponse.json({
    pharmacies: pharmacies.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      phone: p.phone,
      latitude: p.latitude,
      longitude: p.longitude,
      pcnLicenseNumber: p.pcnLicenseNumber,
      verificationStatus: p.verificationStatus,
      ownerEmail: p.owner.email,
      ownerPhone: p.owner.phone,
      inventoryCount: p._count.inventory,
      createdAt: p.createdAt,
    })),
  })
}
