import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { optionalBrand, optionalDate, optionalQuantity } from '@/lib/inventoryFields'
import { DRUG_FORMS } from '@/lib/drugForms'
import { isValidCategory } from '@/lib/drugCategories'
import { upsertDrug, DuplicateDrugError } from '@/lib/upsertDrug'
import { notifyStockAvailable } from '@/lib/notify'
import { offsetPage, offsetResult } from '@/lib/pagination'

async function ownPharmacy(userId: string) {
  return prisma.pharmacy.findUnique({ where: { ownerUserId: userId } })
}

// The owner's pharmacy + full inventory (drug details included)
export async function GET(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const pharmacy = await ownPharmacy(session.userId)
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })

  // A pharmacy with a few thousand lines used to send all of them on every
  // dashboard load. Offset paging: the list is alphabetical and browsed,
  // and the owner wants to see how many they have.
  const { take, skip, page } = offsetPage(req.nextUrl.searchParams)
  // Counted here rather than from the twenty rows on screen: an owner with
  // 200 drugs needs to know how many of the whole list have gone quiet, not
  // how many did on this page.
  const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [total, inStockCount, staleCount, items] = await Promise.all([
    prisma.pharmacyInventory.count({ where: { pharmacyId: pharmacy.id } }),
    prisma.pharmacyInventory.count({ where: { pharmacyId: pharmacy.id, inStock: true } }),
    prisma.pharmacyInventory.count({
      where: { pharmacyId: pharmacy.id, inStock: true, updatedAt: { lt: staleBefore } },
    }),
    prisma.pharmacyInventory.findMany({
      where: { pharmacyId: pharmacy.id },
      include: { drug: true },
      orderBy: [{ drug: { genericName: 'asc' } }, { drug: { strength: 'asc' } }],
      take,
      skip,
    }),
  ])

  return NextResponse.json({
    ...offsetResult([], total, { take, page }),
    // Counted in the database, not by measuring the page — the dashboard
    // header reports the whole shop, not the twenty rows on screen.
    inStockCount,
    // In-stock rows past the 24-hour cliff — invisible to patients until
    // somebody confirms them.
    staleCount,
    pharmacy: {
      id: pharmacy.id,
      name: pharmacy.name,
      address: pharmacy.address,
      state: pharmacy.state,
      lga: pharmacy.lga,
      // Read-only in the dashboard — shown so an owner can check what was
      // registered without being able to edit it (see api/pharmacy/route.ts)
      pcnLicenseNumber: pharmacy.pcnLicenseNumber,
      phone: pharmacy.phone,
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
      stockLevel: i.stockLevel,
      updatedAt: i.updatedAt,
      drug: {
        id: i.drug.id,
        genericName: i.drug.genericName,
        brandNames: i.drug.brandNames,
        strength: i.drug.strength,
        form: i.drug.form,
        packSize: i.drug.packSize,
        category: i.drug.category,
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
  category: z
    .string()
    .refine((v) => v === '' || isValidCategory(v), { message: 'Unknown drug category' })
    .optional()
    .transform((v) => (v ? v : null)),
})

const addSchema = z
  .object({
    drugId: z.string().min(1).optional(),
    newDrug: newDrugSchema.optional(),
    brand: optionalBrand,
    expiryDate: optionalDate,
    quantity: optionalQuantity,
    stockLevel: z.enum(['PLENTY', 'LOW', 'LAST_FEW']).nullish(),
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
