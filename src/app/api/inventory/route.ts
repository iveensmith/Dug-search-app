import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { optionalBrand, optionalDate, optionalQuantity } from '@/lib/inventoryFields'
import { DRUG_FORMS } from '@/lib/drugForms'
import { upsertDrug, DuplicateDrugError } from '@/lib/upsertDrug'
import { notifyStockAvailable } from '@/lib/notify'

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
      state: pharmacy.state,
      verificationStatus: pharmacy.verificationStatus,
      open24h: pharmacy.open24h,
      opensAt: pharmacy.opensAt,
      closesAt: pharmacy.closesAt,
    },
    items: items.map((i) => ({
      id: i.id,
      inStock: i.inStock,
      brand: i.brand,
      expiryDate: i.expiryDate,
      quantity: i.quantity,
      updatedAt: i.updatedAt,
      drug: {
        id: i.drug.id,
        genericName: i.drug.genericName,
        brandNames: i.drug.brandNames,
        strength: i.drug.strength,
        form: i.drug.form,
        packSize: i.drug.packSize,
      },
    })),
  })
}

const newDrugSchema = z.object({
  genericName: z.string().trim().min(2).max(120),
  strength: z.string().trim().min(1).max(60),
  form: z.enum(DRUG_FORMS),
  packSize: z
    .string()
    .max(60)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null)),
  brand: z
    .string()
    .max(80)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
})

const addSchema = z
  .object({
    drugId: z.string().min(1).optional(),
    newDrug: newDrugSchema.optional(),
    brand: optionalBrand,
    expiryDate: optionalDate,
    quantity: optionalQuantity,
  })
  .refine((d) => d.drugId || d.newDrug, { message: 'Pick a drug from the list, or add a new one' })

// Add a drug to the pharmacy's inventory (in stock) — either an existing
// drug from the master list, or a brand-new one this pharmacy is the first
// to list (upserted into the shared Drug catalog so it's searchable by
// everyone from then on).
export async function POST(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const pharmacy = await ownPharmacy(session.userId)
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })
  if (pharmacy.verificationStatus !== 'APPROVED') {
    return NextResponse.json({ error: 'Pharmacy not approved yet' }, { status: 403 })
  }

  const parsed = addSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid drug' }, { status: 400 })
  }
  const { drugId, newDrug, brand, expiryDate, quantity } = parsed.data

  let drug
  if (drugId) {
    drug = await prisma.drug.findUnique({ where: { id: drugId } })
    if (!drug) return NextResponse.json({ error: 'Unknown drug' }, { status: 404 })
  } else {
    try {
      drug = await upsertDrug(newDrug!)
    } catch (e) {
      if (e instanceof DuplicateDrugError) {
        return NextResponse.json({ error: 'That drug already exists — search for it above instead' }, { status: 409 })
      }
      throw e
    }
  }

  const item = await prisma.pharmacyInventory.upsert({
    where: { pharmacyId_drugId: { pharmacyId: pharmacy.id, drugId: drug.id } },
    create: { pharmacyId: pharmacy.id, drugId: drug.id, inStock: true, brand, expiryDate, quantity },
    update: { inStock: true, brand, expiryDate, quantity },
    include: { drug: true },
  })

  // Awaited (not fire-and-forget) — on Vercel a detached promise can be
  // killed once the response is sent, so this must finish before we return.
  await notifyStockAvailable(drug.id, pharmacy.id).catch((e) => console.error('[notify] failed:', e))

  return NextResponse.json({ item }, { status: 201 })
}
