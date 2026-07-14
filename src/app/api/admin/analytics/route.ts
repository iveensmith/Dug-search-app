import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

// Coverage-gap analytics from SearchLog:
// - stockGaps: known drugs people searched for but nobody had in stock
// - unmatchedQueries: free-text searches that matched no drug in the list
export async function GET(req: NextRequest) {
  const session = await requireSession(req, ['ADMIN'])
  if (session instanceof NextResponse) return session

  const [totals, stockGaps, unmatchedQueries] = await Promise.all([
    prisma.$queryRaw<{ total: bigint; noResults: bigint }[]>`
      SELECT COUNT(*) AS "total",
             COUNT(*) FILTER (WHERE NOT "hadResults") AS "noResults"
      FROM "SearchLog"
    `,
    prisma.$queryRaw<
      { drugId: string; genericName: string; strength: string; form: string; searches: bigint; lastSearched: Date }[]
    >`
      SELECT d."id" AS "drugId", d."genericName", d."strength", d."form",
             COUNT(*) AS "searches", MAX(s."createdAt") AS "lastSearched"
      FROM "SearchLog" s
      JOIN "Drug" d ON d."id" = s."drugId"
      WHERE NOT s."hadResults"
      GROUP BY d."id", d."genericName", d."strength", d."form"
      ORDER BY COUNT(*) DESC
      LIMIT 50
    `,
    prisma.$queryRaw<{ queryText: string; searches: bigint; lastSearched: Date }[]>`
      SELECT LOWER(TRIM("queryText")) AS "queryText",
             COUNT(*) AS "searches", MAX("createdAt") AS "lastSearched"
      FROM "SearchLog"
      WHERE "drugId" IS NULL AND TRIM("queryText") <> ''
      GROUP BY LOWER(TRIM("queryText"))
      ORDER BY COUNT(*) DESC
      LIMIT 50
    `,
  ])

  return NextResponse.json({
    totalSearches: Number(totals[0]?.total ?? 0),
    noResultSearches: Number(totals[0]?.noResults ?? 0),
    stockGaps: stockGaps.map((g) => ({ ...g, searches: Number(g.searches) })),
    unmatchedQueries: unmatchedQueries.map((q) => ({ ...q, searches: Number(q.searches) })),
  })
}
