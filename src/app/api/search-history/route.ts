import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

// The caller's own recent searches — powers /search-history. Any logged-in
// role can have search history (nothing stops a pharmacy owner from using
// the patient search), so no role restriction beyond "logged in".
export async function GET(req: NextRequest) {
  const session = await requireSession(req)
  if (session instanceof NextResponse) return session

  const logs = await prisma.searchLog.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { drug: true },
  })

  return NextResponse.json({
    searches: logs.map((l) => ({
      id: l.id,
      queryText: l.queryText,
      state: l.state,
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
    })),
  })
}
