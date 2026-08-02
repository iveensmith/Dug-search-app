import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

// The pharmacy's current stock as a CSV download. Columns are exactly the
// ones POST /api/inventory/bulk accepts, so an exported file can be edited
// and re-uploaded as-is.
export async function GET(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const pharmacy = await prisma.pharmacy.findUnique({ where: { ownerUserId: session.userId } })
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })

  const items = await prisma.pharmacyInventory.findMany({
    where: { pharmacyId: pharmacy.id },
    include: { drug: true },
    orderBy: [{ drug: { genericName: 'asc' } }, { drug: { strength: 'asc' } }],
  })

  const csv = Papa.unparse(
    items.map((i) => ({
      genericName: i.drug.genericName,
      strength: i.drug.strength,
      form: i.drug.form,
      packSize: i.drug.packSize ?? '',
      brand: i.brand ?? '',
      quantity: i.quantity ?? '',
      expiryDate: i.expiryDate ? i.expiryDate.toISOString().slice(0, 10) : '',
      inStock: i.inStock ? 'true' : 'false',
    })),
    { columns: ['genericName', 'strength', 'form', 'packSize', 'brand', 'quantity', 'expiryDate', 'inStock'] },
  )

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="mediquest-stock-${date}.csv"`,
    },
  })
}
