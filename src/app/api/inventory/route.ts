import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

async function ownPharmacy(userId: string) {
  return prisma.pharmacy.findUnique({ where: { ownerUserId: userId } })
}

// The owner's pharmacy + full inventory (drug details included)
export async function GET(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const pharmacy = await ownPharmacy(session.userId)
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })

  const items = await prisma.pharmacyInventory.findMany({
    where: { pharmacyId: pharmacy.id },
    include: { drug: true },
    orderBy: [{ drug: { genericName: 'asc' } }, { drug: { strength: 'asc' } }],
  })

  return NextResponse.json({
    pharmacy: {
      id: pharmacy.id,
      name: pharmacy.name,
      address: pharmacy.address,
      verificationStatus: pharmacy.verificationStatus,
    },
    items: items.map((i) => ({
      id: i.id,
      inStock: i.inStock,
      updatedAt: i.updatedAt,
      drug: {
        id: i.drug.id,
        genericName: i.drug.genericName,
        brandNames: i.drug.brandNames,
        strength: i.drug.strength,
        form: i.drug.form,
      },
    })),
  })
}

const addSchema = z.object({ drugId: z.string().min(1) })

// Add a drug from the master list to the pharmacy's inventory (in stock)
export async function POST(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const pharmacy = await ownPharmacy(session.userId)
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })
  if (pharmacy.verificationStatus !== 'APPROVED') {
    return NextResponse.json({ error: 'Pharmacy not approved yet' }, { status: 403 })
  }

  const parsed = addSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'drugId required' }, { status: 400 })

  const drug = await prisma.drug.findUnique({ where: { id: parsed.data.drugId } })
  if (!drug) return NextResponse.json({ error: 'Unknown drug' }, { status: 404 })

  const item = await prisma.pharmacyInventory.upsert({
    where: { pharmacyId_drugId: { pharmacyId: pharmacy.id, drugId: drug.id } },
    create: { pharmacyId: pharmacy.id, drugId: drug.id, inStock: true },
    update: { inStock: true },
    include: { drug: true },
  })

  return NextResponse.json({ item }, { status: 201 })
}
