/**
 * One-off maintenance: fill in SearchLog.lga for rows logged before that
 * column existed.
 *
 *   DATABASE_URL="postgres://…" npx tsx scripts/backfill-search-lga.ts
 *   …add --commit to actually write; the default is a dry run.
 *
 * Only rows that recorded real coordinates can be recovered — the search
 * route deliberately logs lat/lng only when the patient shared their
 * actual position, never the state-capital fallback. Rows without
 * coordinates stay null rather than being guessed at from the state, since
 * a wrong LGA would put fake demand in some pharmacy's feed.
 *
 * Nominatim's usage policy is one request per second with a real
 * User-Agent, so this is deliberately slow. A few thousand rows will take
 * an hour; it's safe to stop and re-run, as it only ever looks at rows
 * still missing an LGA.
 */
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { lgasForState } from '../src/lib/lgas'

// Same construction as prisma/seed.ts — Prisma 7 needs a driver adapter
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})
const COMMIT = process.argv.includes('--commit')
const GAP_MS = 1100 // Nominatim: max 1 request/second

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function lgaFor(state: string, lat: number, lng: number): Promise<string | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
    { headers: { 'User-Agent': 'MediQuest/1.0 (search-log LGA backfill)' } },
  ).catch(() => null)
  if (!res?.ok) return null

  const data = await res.json().catch(() => null)
  const candidates = [data?.address?.county, data?.address?.city, data?.address?.town]
    .filter((v: unknown): v is string => typeof v === 'string')
    .map((v) => v.replace(/\s+(local government area|lga)$/i, '').trim().toLowerCase())

  return lgasForState(state).find((l) => candidates.includes(l.toLowerCase())) ?? null
}

async function main() {
  const rows = await prisma.searchLog.findMany({
    where: { lga: null, state: { not: null }, latitude: { not: null }, longitude: { not: null } },
    select: { id: true, state: true, latitude: true, longitude: true },
    orderBy: { createdAt: 'desc' },
  })

  const skipped = await prisma.searchLog.count({
    where: { lga: null, OR: [{ latitude: null }, { longitude: null }, { state: null }] },
  })

  console.log(`${rows.length} rows can be resolved from coordinates.`)
  console.log(`${skipped} rows have no usable coordinates and will stay unset.`)
  if (!COMMIT) console.log('\nDRY RUN — re-run with --commit to write.\n')

  let matched = 0
  let unmatched = 0

  for (const [i, row] of rows.entries()) {
    const lga = await lgaFor(row.state!, row.latitude!, row.longitude!)
    if (lga) {
      matched++
      if (COMMIT) await prisma.searchLog.update({ where: { id: row.id }, data: { lga } })
    } else {
      unmatched++
    }
    if ((i + 1) % 25 === 0 || i === rows.length - 1) {
      console.log(`  ${i + 1}/${rows.length} — ${matched} matched, ${unmatched} unresolved`)
    }
    await sleep(GAP_MS)
  }

  console.log(
    `\nDone. ${matched} ${COMMIT ? 'updated' : 'would be updated'}, ` +
      `${unmatched} could not be matched to an LGA, ${skipped} skipped.`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
