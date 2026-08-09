import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { DrugSuggestion } from '@/lib/types'

/**
 * Autocomplete against the curated drug list: generic OR brand name match.
 *
 * Both sides are matched with ILIKE '%q%', which no btree can serve, so
 * each has a trigram GIN index behind it (migration
 * 20260807090000_search_and_fk_indexes). The brand-name side reads
 * "drugBrandNamesText"("brandNames") rather than unnest()-ing the array
 * because an index has to be built on a fixed expression — the wording
 * here has to keep matching the index's, or the planner silently drops
 * back to scanning every drug on every keystroke.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ drugs: [] })

  // % and _ are wildcards in LIKE — escaped so a query of "%" doesn't match
  // the entire catalogue.
  const pattern = `%${q.replace(/([\\%_])/g, '\\$1')}%`
  // MATERIALIZED is load-bearing. Written as one statement, the planner
  // sees ORDER BY … LIMIT 10, decides it can walk the name index in sort
  // order and stop early, and skips the trigram indexes entirely — it
  // expects to find ten matches quickly and instead filters thousands of
  // rows. Fencing the match off forces it to plan the filter on its own
  // merits, where the trigram indexes win, and only then sort. Same rows,
  // same order, 14ms down to 1ms.
  const drugs = await prisma.$queryRaw<DrugSuggestion[]>`
    WITH matches AS MATERIALIZED (
      SELECT "id", "genericName", "brandNames", "strength", "form",
        "category", "packSize", "dispensing"
      FROM "Drug"
      WHERE "genericName" ILIKE ${pattern}
         OR "drugBrandNamesText"("brandNames") ILIKE ${pattern}
    )
    SELECT * FROM matches
    ORDER BY "genericName", "strength"
    LIMIT 10
  `
  return NextResponse.json({ drugs })
}
