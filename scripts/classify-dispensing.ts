/**
 * Sets which medicines need a prescription, in bulk, from a file you have
 * checked.
 *
 * The admin panel handles one drug at a time, which is right for a
 * correction and hopeless for a catalogue of thousands. This is the bulk
 * path — but it never decides anything. It applies exactly the rows in
 * the file you hand it and nothing else, because whether a medicine is
 * prescription-only in Nigeria is a regulatory fact about that medicine,
 * not something to be inferred from its name by a script.
 *
 * Run with:
 *
 *   # What is left to do, and what to do first
 *   DATABASE_URL="…" npx tsx scripts/classify-dispensing.ts --report
 *
 *   # Show what a file would change, without changing it
 *   DATABASE_URL="…" npx tsx scripts/classify-dispensing.ts --apply my-list.csv
 *
 *   # Actually write it
 *   DATABASE_URL="…" npx tsx scripts/classify-dispensing.ts --apply my-list.csv --commit
 *
 * The file is two columns, generic name and class:
 *
 *   Paracetamol,OTC
 *   Amoxicillin,POM
 *   Chloramphenicol eye drops,PHARMACY_ONLY
 *
 * Blank lines and lines starting with # are ignored, so you can keep your
 * reasoning in the file beside the decisions.
 */

import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { DISPENSING_CLASSES, isDispensingClass } from '../src/lib/dispensing'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

/** How many unclassified drugs to list in the report. */
const REPORT_LIMIT = 40

/**
 * What is left, and which ones matter.
 *
 * Ordered by how often patients have searched for the drug and how many
 * pharmacies stock it, because classifying all eight thousand rows is not
 * the job — classifying the couple of hundred anyone actually looks for
 * is, and the rest can stay silent indefinitely without hurting anybody.
 */
async function report() {
  const [total, classified] = await Promise.all([
    prisma.drug.count(),
    prisma.drug.count({ where: { dispensing: { not: null } } }),
  ])

  console.log(`\nDrugs: ${total}`)
  console.log(`  classified:   ${classified}`)
  console.log(`  unclassified: ${total - classified}   (these show no badge to patients)`)

  for (const c of DISPENSING_CLASSES) {
    const n = await prisma.drug.count({ where: { dispensing: c.key } })
    if (n > 0) console.log(`    ${c.key.padEnd(14)} ${n}`)
  }

  const rows = await prisma.$queryRaw<
    { genericName: string; strength: string; searches: number; shops: number }[]
  >`
    SELECT d."genericName", d."strength",
           COUNT(DISTINCT s."id")::int AS "searches",
           COUNT(DISTINCT i."pharmacyId")::int AS "shops"
    FROM "Drug" d
    LEFT JOIN "SearchLog" s ON s."drugId" = d."id"
    LEFT JOIN "PharmacyInventory" i ON i."drugId" = d."id" AND i."inStock" = true
    WHERE d."dispensing" IS NULL
    GROUP BY d."id", d."genericName", d."strength"
    ORDER BY "searches" DESC, "shops" DESC, d."genericName"
    LIMIT ${REPORT_LIMIT}
  `

  if (rows.length === 0) {
    console.log('\nNothing unclassified. Done.\n')
    return
  }

  console.log(`\nWorth doing first — unclassified, most searched:\n`)
  console.log(`  ${'MEDICINE'.padEnd(44)} ${'SEARCHES'.padStart(8)} ${'SHOPS'.padStart(6)}`)
  for (const r of rows) {
    const name = `${r.genericName} ${r.strength}`.slice(0, 44)
    console.log(`  ${name.padEnd(44)} ${String(r.searches).padStart(8)} ${String(r.shops).padStart(6)}`)
  }
  console.log(
    `\nPut your rulings in a CSV (generic name,class) and apply it with --apply.\n` +
      `Classes: ${DISPENSING_CLASSES.map((c) => c.key).join(', ')}\n`,
  )
}

type Ruling = { genericName: string; dispensing: string; line: number }

function parseFile(path: string): Ruling[] {
  const out: Ruling[] = []
  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  for (const [i, raw] of lines.entries()) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    // Split on the LAST comma: generic names contain commas
    // ("Artemether, Lumefantrine") far more often than classes do.
    const cut = line.lastIndexOf(',')
    if (cut === -1) {
      throw new Error(`Line ${i + 1}: expected "generic name,CLASS" — got "${line}"`)
    }
    const genericName = line.slice(0, cut).trim().replace(/^"|"$/g, '')
    const dispensing = line.slice(cut + 1).trim().toUpperCase()
    if (!genericName) throw new Error(`Line ${i + 1}: no medicine name`)
    if (!isDispensingClass(dispensing)) {
      throw new Error(
        `Line ${i + 1}: "${dispensing}" is not a class. Use one of: ` +
          DISPENSING_CLASSES.map((c) => c.key).join(', '),
      )
    }
    out.push({ genericName, dispensing, line: i + 1 })
  }
  return out
}

/**
 * Applies a checked file.
 *
 * Matched on generic name, case-insensitively and exactly — never a
 * partial match. "Amoxicillin" must not also catch "Amoxicillin +
 * Clavulanate", which is a different medicine that may be classified
 * differently, and a script that quietly widened its own scope would be
 * writing regulatory claims nobody made.
 *
 * Prints every change and every miss, and writes nothing without
 * --commit.
 */
async function apply(path: string, commit: boolean) {
  const rulings = parseFile(path)
  console.log(`\n${rulings.length} ruling${rulings.length === 1 ? '' : 's'} read from ${path}`)
  if (!commit) console.log('DRY RUN — nothing will be written. Add --commit to apply.\n')
  else console.log('COMMITTING.\n')

  let changed = 0
  let already = 0
  const missing: string[] = []
  const overwrites: string[] = []

  for (const r of rulings) {
    const drugs = await prisma.drug.findMany({
      where: { genericName: { equals: r.genericName, mode: 'insensitive' } },
      select: { id: true, genericName: true, strength: true, form: true, dispensing: true },
    })
    if (drugs.length === 0) {
      missing.push(`line ${r.line}: "${r.genericName}" — no such medicine in the catalogue`)
      continue
    }
    for (const d of drugs) {
      if (d.dispensing === r.dispensing) {
        already += 1
        continue
      }
      // Changing an existing ruling is legitimate, but it should never be
      // silent — somebody set that one deliberately.
      if (d.dispensing !== null) {
        overwrites.push(
          `  ${d.genericName} ${d.strength} (${d.form.toLowerCase()}): ${d.dispensing} → ${r.dispensing}`,
        )
      }
      console.log(
        `  ${commit ? 'set  ' : 'would'} ${d.genericName} ${d.strength} (${d.form.toLowerCase()}) → ${r.dispensing}`,
      )
      if (commit) {
        await prisma.drug.update({
          where: { id: d.id },
          data: { dispensing: r.dispensing as 'POM' | 'PHARMACY_ONLY' | 'OTC' },
        })
      }
      changed += 1
    }
  }

  console.log(`\n${commit ? 'Changed' : 'Would change'}: ${changed}`)
  if (already > 0) console.log(`Already correct: ${already}`)
  if (overwrites.length > 0) {
    console.log(`\nExisting rulings replaced (${overwrites.length}):`)
    overwrites.forEach((o) => console.log(o))
  }
  if (missing.length > 0) {
    console.log(`\nNot found (${missing.length}) — check the spelling against --report:`)
    missing.forEach((m) => console.log(`  ${m}`))
  }
  console.log('')
}

async function main() {
  const args = process.argv.slice(2)
  const applyIndex = args.indexOf('--apply')

  if (args.includes('--report') || args.length === 0) {
    await report()
    return
  }
  if (applyIndex !== -1) {
    const path = args[applyIndex + 1]
    if (!path || path.startsWith('--')) {
      console.error('--apply needs a file: --apply my-list.csv')
      process.exitCode = 1
      return
    }
    await apply(path, args.includes('--commit'))
    return
  }
  console.error('Usage: --report | --apply <file.csv> [--commit]')
  process.exitCode = 1
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
