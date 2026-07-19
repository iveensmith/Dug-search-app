import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { DRUG_FORMS } from '@/lib/drugForms'
import { upsertDrug, DuplicateDrugError } from '@/lib/upsertDrug'
import { notifyStockAvailable } from '@/lib/notify'

const bodySchema = z.object({ csv: z.string().min(1) })

type CsvRow = Record<string, string>

function parseInStock(raw: string | undefined): boolean {
  if (!raw) return true
  return !['false', '0', 'no', 'n'].includes(raw.trim().toLowerCase())
}

function parseQuantity(raw: string | undefined): number | null {
  if (!raw?.trim()) return null
  const n = Number(raw.trim())
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null
}

function parseExpiryDate(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null
  const d = new Date(raw.trim())
  return Number.isNaN(d.getTime()) ? null : d
}

// Columns: genericName, strength, form, packSize, brand, quantity,
// expiryDate, inStock. Only genericName/strength/form are required. Bad
// rows are collected as errors, not fatal — the rest of the file still
// imports. Reuses upsertDrug (same compound-key logic as the single "add a
// new drug" flow) so a drug added via CSV by one pharmacy is the same Drug
// row another pharmacy's CSV (or single-add) would land on.
export async function POST(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const pharmacy = await prisma.pharmacy.findUnique({ where: { ownerUserId: session.userId } })
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })
  if (pharmacy.verificationStatus !== 'APPROVED') {
    return NextResponse.json({ error: 'Pharmacy not approved yet' }, { status: 403 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'csv (text) required' }, { status: 400 })

  const { data: rows, errors: parseErrors } = Papa.parse<CsvRow>(parsed.data.csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  const errors: { row: number; message: string }[] = parseErrors.map((e) => ({
    row: (e.row ?? 0) + 2, // +1 for the header row, +1 for 1-indexing
    message: e.message,
  }))

  let created = 0
  let updated = 0
  const stockedDrugIds = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2
    const genericName = row.genericName?.trim()
    const strength = row.strength?.trim()
    const formRaw = row.form?.trim().toUpperCase()

    if (!genericName || !strength || !formRaw) {
      errors.push({ row: rowNum, message: 'genericName, strength, and form are required' })
      continue
    }
    if (!(DRUG_FORMS as readonly string[]).includes(formRaw)) {
      errors.push({ row: rowNum, message: `Unknown form "${row.form}" — must be one of ${DRUG_FORMS.join(', ')}` })
      continue
    }

    try {
      const drug = await upsertDrug({
        genericName,
        strength,
        form: formRaw as (typeof DRUG_FORMS)[number],
        packSize: row.packSize?.trim() || null,
        brand: row.brand?.trim() || undefined,
      })

      const existing = await prisma.pharmacyInventory.findUnique({
        where: { pharmacyId_drugId: { pharmacyId: pharmacy.id, drugId: drug.id } },
      })
      const inStock = parseInStock(row.inStock)

      await prisma.pharmacyInventory.upsert({
        where: { pharmacyId_drugId: { pharmacyId: pharmacy.id, drugId: drug.id } },
        create: {
          pharmacyId: pharmacy.id,
          drugId: drug.id,
          inStock,
          brand: row.brand?.trim() || null,
          quantity: parseQuantity(row.quantity),
          expiryDate: parseExpiryDate(row.expiryDate),
        },
        update: {
          inStock,
          brand: row.brand?.trim() || null,
          quantity: parseQuantity(row.quantity),
          expiryDate: parseExpiryDate(row.expiryDate),
        },
      })

      if (existing) updated++
      else created++
      if (inStock) stockedDrugIds.add(drug.id)
    } catch (e) {
      if (e instanceof DuplicateDrugError) {
        errors.push({ row: rowNum, message: 'That drug already exists with slightly different details' })
      } else {
        errors.push({ row: rowNum, message: 'Could not save this row' })
      }
    }
  }

  for (const drugId of stockedDrugIds) {
    await notifyStockAvailable(drugId, pharmacy.id).catch((e) => console.error('[notify] failed:', e))
  }

  return NextResponse.json({ created, updated, errors })
}
