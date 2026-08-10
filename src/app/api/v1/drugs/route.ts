import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticateKey } from '@/lib/apiKeys'

/**
 * Looking up our ids for the medicines a caller stocks.
 *
 * The half of an integration nobody plans for: a POS knows its own
 * product codes and nothing about ours, and something has to bridge the
 * two. Doing that mapping once, and storing the result, is the difference
 * between an integration that works and one that re-guesses every night.
 *
 * Read-only and key-authenticated. The catalogue is not secret — it is
 * the same list the patient search reads — but an open endpoint is a free
 * database-backed search for anyone who finds it, and there is no reason
 * to hand that out to callers who are not pharmacies.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateKey(req)
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, ...(auth.retryAfterSeconds ? { retryAfterSeconds: auth.retryAfterSeconds } : {}) },
      { status: auth.status },
    )
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) {
    return NextResponse.json({ error: 'Send q= with at least two characters' }, { status: 400 })
  }

  // Escaped for the same reason the patient search escapes it: % and _ are
  // LIKE wildcards, and a query of "%" would otherwise page the catalogue.
  const pattern = `%${q.replace(/([\\%_])/g, '\\$1')}%`

  // Same MATERIALIZED fence and trigram indexes as /api/drugs/search — see
  // the comment there for why the sort has to stay outside it.
  const drugs = await prisma.$queryRaw<
    Array<{ id: string; genericName: string; brandNames: string[]; strength: string; form: string; dispensing: string | null }>
  >`
    WITH matches AS MATERIALIZED (
      SELECT "id", "genericName", "brandNames", "strength", "form", "dispensing"
      FROM "Drug"
      WHERE "genericName" ILIKE ${pattern}
         OR "drugBrandNamesText"("brandNames") ILIKE ${pattern}
    )
    SELECT * FROM matches
    ORDER BY "genericName", "strength"
    LIMIT 25
  `

  return NextResponse.json({ drugs })
}
