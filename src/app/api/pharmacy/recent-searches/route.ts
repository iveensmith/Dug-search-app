import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

// Local demand signal: recent patient searches in this pharmacy's own
// state, flagged against the pharmacy's own inventory so they can see what
// nearby patients are looking for — stocked or not.
export async function GET(req: NextRequest) {
  const session = await requireSession(req, ['PHARMACY_OWNER'])
  if (session instanceof NextResponse) return session

  const pharmacy = await prisma.pharmacy.findUnique({ where: { ownerUserId: session.userId } })
  if (!pharmacy) return NextResponse.json({ error: 'No pharmacy for this account' }, { status: 404 })

  const [logs, inventoryDrugIds] = await Promise.all([
    prisma.searchLog.findMany({
      where: { state: pharmacy.state },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { drug: true },
    }),
    prisma.pharmacyInventory.findMany({
      where: { pharmacyId: pharmacy.id, inStock: true },
      select: { drugId: true },
    }),
  ])

  const stockedIds = new Set(inventoryDrugIds.map((i) => i.drugId))

  return NextResponse.json({
    searches: logs.map((l) => ({
      id: l.id,
      queryText: l.queryText,
      hadResults: l.hadResults,
      createdAt: l.createdAt,
      drug: l.drug
        ? {
            id: l.drug.id,
            genericName: l.drug.genericName,
            brandNames: l.drug.brandNames,
            strength: l.drug.strength,
            form: l.drug.form,
          }
        : null,
      youStock: l.drugId ? stockedIds.has(l.drugId) : false,
    })),
  })
}
