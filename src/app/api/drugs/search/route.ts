import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { DrugSuggestion } from '@/lib/types'

// Autocomplete against the curated drug list: generic OR brand name match.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ drugs: [] })

  const pattern = `%${q}%`
  const drugs = await prisma.$queryRaw<DrugSuggestion[]>`
    SELECT "id", "genericName", "brandNames", "strength", "form"
    FROM "Drug"
    WHERE "genericName" ILIKE ${pattern}
       OR EXISTS (SELECT 1 FROM unnest("brandNames") bn WHERE bn ILIKE ${pattern})
    ORDER BY "genericName", "strength"
    LIMIT 10
  `
  return NextResponse.json({ drugs })
}
