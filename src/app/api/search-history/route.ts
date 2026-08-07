import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { cursorPage, cursorResult } from '@/lib/pagination'

// The caller's own recent searches — powers /search-history. Any logged-in
// role can have search history (nothing stops a pharmacy owner from using
// the patient search), so no role restriction beyond "logged in".
export async function GET(req: NextRequest) {
  const session = await requireSession(req)
  if (session instanceof NextResponse) return session

  const { take, cursorArgs } = cursorPage(req.nextUrl.searchParams)
  const logs = await prisma.searchLog.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...cursorArgs,
    include: { drug: true },
  })

  const { items, nextCursor } = cursorResult(logs, take)

  return NextResponse.json({
    nextCursor,
    searches: items.map((l) => ({
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

/** Clears the caller's own search history. Their rows only — a search log
 *  with a null userId (logged-out searches) is anonymous analytics and
 *  isn't the caller's to delete. */
export async function DELETE(req: NextRequest) {
  const session = await requireSession(req)
  if (session instanceof NextResponse) return session

  const { count } = await prisma.searchLog.deleteMany({ where: { userId: session.userId } })
  return NextResponse.json({ cleared: count })
}
