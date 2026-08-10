import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { DrugSuggestion } from '@/lib/types'

/**
 * Autocomplete: generic name, catalogue brand name, or the brand a
 * pharmacy typed against its own stock.
 *
 * That third source matters because it is the name on the box. A patient
 * holding Aquaclav searches "Aquaclav", and the catalogue only knows
 * "Amoxicillin/Clavulanate" — so the app said no such drug exists while a
 * pharmacy down the road had it listed under exactly that name. Anything
 * a pharmacy has registered is something a patient can be sold, so it is
 * something a patient can search for.
 *
 * Every side is matched with ILIKE '%q%', which no btree can serve, so
 * each has a trigram GIN index behind it (migrations 20260807090000 and
 * 20260810120000). The catalogue brand side reads
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
      SELECT d."id", d."genericName", d."brandNames", d."strength", d."form",
        d."category", d."packSize", d."dispensing", NULL::text AS "stockedAs"
      FROM "Drug" d
      WHERE d."genericName" ILIKE ${pattern}
         OR "drugBrandNamesText"(d."brandNames") ILIKE ${pattern}

      UNION ALL

      -- Brands pharmacies registered against their own stock. DISTINCT ON
      -- collapses the same drug stocked by many pharmacies to one row —
      -- the patient is choosing a medicine here, not a shop, and the next
      -- screen is what lists who has it.
      --
      -- Wrapped in its own SELECT because an ORDER BY written directly in
      -- a UNION arm belongs to the whole union, not the arm, and DISTINCT
      -- ON requires one that matches it.
      SELECT * FROM (
        SELECT DISTINCT ON (i."drugId")
          d."id", d."genericName", d."brandNames", d."strength", d."form",
          d."category", d."packSize", d."dispensing", i."brand" AS "stockedAs"
        FROM "PharmacyInventory" i
        JOIN "Drug" d ON d."id" = i."drugId"
        WHERE i."brand" ILIKE ${pattern}
        ORDER BY i."drugId", i."brand"
      ) stocked
    ),
    -- A drug found by both routes appears twice; the catalogue row wins,
    -- because "stocked as X" is only worth saying when X is why it matched.
    -- Deliberately outside the fence: DISTINCT ON needs its own leading
    -- ORDER BY, and putting that inside the matches CTE would hand the
    -- planner back the sort it uses as an excuse to skip the trigram
    -- indexes.
    deduped AS (
      SELECT DISTINCT ON ("id") * FROM matches
      ORDER BY "id", "stockedAs" NULLS FIRST
    )
    SELECT * FROM deduped
    ORDER BY "genericName", "strength"
    LIMIT 10
  `
  return NextResponse.json({ drugs })
}
