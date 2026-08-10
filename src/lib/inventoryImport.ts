import { prisma } from './db'
import { DRUG_FORMS, type DrugFormValue } from './drugForms'
import { mapColumns, type CsvTable, type ImportField } from './csv'

/**
 * Turning a pharmacy's stock file into rows of this app's medicines.
 *
 * The governing rule: this never guesses. A row that cannot be resolved
 * to exactly one drug with confidence is handed back for the owner to
 * decide, and a row nobody decides on is skipped. Nothing here creates a
 * Drug either — a typo in a spreadsheet would otherwise become a
 * permanent entry in a catalogue every pharmacy in the country shares.
 *
 * The dangerous failure is not a missed row, it is a wrong one. "625 mg"
 * silently matched to the 1 g listing puts a real patient in front of a
 * pharmacist holding the wrong box, and a stock file has no way to notice
 * it happened. So strength and form are treated as facts that must agree
 * when the file states them, never as hints to be talked out of.
 */

export type RowStatus =
  /** One confident match. Will be written if the owner applies. */
  | 'matched'
  /** Several plausible drugs — the owner picks, or it is skipped. */
  | 'ambiguous'
  /** Nothing close enough. Suggestions are offered but nothing is chosen. */
  | 'unmatched'
  /** Not usable as a row at all (no medicine name). */
  | 'invalid'
  /** The same medicine appeared earlier in the file. */
  | 'duplicate'

export type DrugCandidate = {
  id: string
  genericName: string
  strength: string
  form: string
  /** Why this drug is being offered, in the owner's terms. */
  via: 'name' | 'brand' | 'stocked-brand' | 'similar'
}

export type ImportRow = {
  /** 1-based line in the file, so the owner can find it in their spreadsheet. */
  line: number
  /** What the file said, kept verbatim for display. */
  source: { name: string; strength: string; form: string; brand: string }
  status: RowStatus
  reason?: string
  /** Set only when status is 'matched'. */
  drugId?: string
  candidates: DrugCandidate[]
  quantity: number | null
  brand: string | null
  expiryDate: string | null
  inStock: boolean
}

export type ImportPreview = {
  rows: ImportRow[]
  counts: Record<RowStatus, number>
  /** Columns we recognised, so the owner can see if a column was ignored. */
  recognised: ImportField[]
  ignoredHeaders: string[]
}

/* ------------------------------------------------------------ normalising */

function normName(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9/+]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * "625mg", "625 MG" and "625 mg" are one strength written three ways;
 * "20/120mg" is a combination. Spaces and case carry no meaning here, so
 * removing them is what lets a file match the catalogue at all.
 */
function normStrength(v: string): string {
  return v
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/micrograms?|mcg|µg/g, 'mcg')
    .replace(/milligrams?/g, 'mg')
    .replace(/grams?/g, 'g')
    .replace(/millilitres?|milliliters?/g, 'ml')
    .replace(/,/g, '.')
}

const STRENGTH_IN_TEXT =
  /(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)*)\s*(mcg|µg|mg|g|ml|iu|%)\b/i

/** Pulls "625mg" out of "AQUACLAV 625MG TAB", for files with one column. */
function strengthFromText(text: string): string {
  const m = text.match(STRENGTH_IN_TEXT)
  return m ? normStrength(`${m[1]}${m[2]}`) : ''
}

const FORM_WORDS: Array<[RegExp, DrugFormValue]> = [
  [/\b(tabs?|tablets?|tb)\b/i, 'TABLET'],
  [/\b(caps?|capsules?)\b/i, 'CAPSULE'],
  [/\b(syrups?|syr)\b/i, 'SYRUP'],
  [/\b(susp|suspensions?)\b/i, 'SUSPENSION'],
  [/\b(inj|injections?|ampoules?|vials?)\b/i, 'INJECTION'],
  [/\b(creams?)\b/i, 'CREAM'],
  [/\b(ointments?|oint)\b/i, 'OINTMENT'],
  [/\b(gels?)\b/i, 'GEL'],
  [/\b(drops?|eye ?drops?|ear ?drops?)\b/i, 'DROPS'],
  [/\b(inhalers?|puffers?)\b/i, 'INHALER'],
  [/\b(suppositor(y|ies)|supp)\b/i, 'SUPPOSITORY'],
]

function formFromText(text: string): DrugFormValue | '' {
  const exact = text.trim().toUpperCase()
  if ((DRUG_FORMS as readonly string[]).includes(exact)) return exact as DrugFormValue
  for (const [re, form] of FORM_WORDS) if (re.test(text)) return form
  return ''
}

/** Strips the strength and form words, leaving something name-like. */
function nameCore(text: string): string {
  let out = text.replace(STRENGTH_IN_TEXT, ' ')
  for (const [re] of FORM_WORDS) out = out.replace(re, ' ')
  // Pack counts: "x14", "* 10", "(30's)"
  out = out.replace(/\b[x*]\s*\d+\b/gi, ' ').replace(/\b\d+\s*'?s\b/gi, ' ')
  return normName(out)
}

/* ------------------------------------------------------------- cell types */

function parseQuantity(v: string): number | null {
  if (!v.trim()) return null
  const n = Number(v.replace(/[,\s]/g, ''))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.trunc(n)
}

const TRUEISH = new Set(['yes', 'y', 'true', '1', 'in stock', 'instock', 'available', 'in'])
const FALSEISH = new Set(['no', 'n', 'false', '0', 'out of stock', 'outofstock', 'out', 'unavailable', 'nil'])

/**
 * Whether the row claims the medicine is on the shelf.
 *
 * With no such column, quantity decides: a stock export listing 0 is
 * saying it has none, and importing that as "in stock" would put a
 * promise on a patient's screen the file explicitly contradicted.
 */
function parseInStock(v: string, quantity: number | null): boolean {
  const t = v.trim().toLowerCase()
  if (TRUEISH.has(t)) return true
  if (FALSEISH.has(t)) return false
  if (quantity !== null) return quantity > 0
  return true
}

/**
 * Day-first, because that is what Nigeria writes and what a Nigerian
 * spreadsheet exports. ISO is accepted too since it is unambiguous.
 * Anything else is dropped rather than guessed — expiry is optional, and
 * a wrong expiry is worse than none.
 */
function parseExpiry(v: string): string | null {
  const t = v.trim()
  if (!t) return null

  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return isoOrNull(+iso[1], +iso[2], +iso[3])

  const dmy = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/)
  if (dmy) {
    const year = +dmy[3] < 100 ? 2000 + +dmy[3] : +dmy[3]
    return isoOrNull(year, +dmy[2], +dmy[1])
  }

  // "03/2027" or "2027-03" — a month with no day means end of that month,
  // which is what an expiry printed as MM/YYYY means on a box.
  const my = t.match(/^(\d{1,2})[/.\-](\d{4})$/)
  if (my) return endOfMonth(+my[2], +my[1])
  const ym = t.match(/^(\d{4})[/.\-](\d{1,2})$/)
  if (ym) return endOfMonth(+ym[1], +ym[2])

  return null
}

function isoOrNull(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return date.toISOString()
}

function endOfMonth(y: number, m: number): string | null {
  if (m < 1 || m > 12) return null
  return new Date(Date.UTC(y, m, 0)).toISOString()
}

/* ---------------------------------------------------------------- matching */

type CatalogueDrug = {
  id: string
  genericName: string
  brandNames: string[]
  strength: string
  form: string
}

/**
 * Similarity for the "did you mean" list only — never for choosing.
 *
 * Dice coefficient over character bigrams: cheap, needs no extension, and
 * good enough to put the right drug in a shortlist of three. It is
 * deliberately not wired to any threshold that would auto-select, because
 * a score has no idea that 500 mg and 5 mg are a hospital visit apart.
 */
/**
 * How alike two names must be before one is worth offering.
 *
 * Tuned against the failure it exists to prevent. At 0.45 an invented
 * word — "Fluxocillinate" — scored 0.46 against Amoxicillin/Clavulanate,
 * because long drug names share a lot of letters, and the screen then
 * offered a real antibiotic as the answer to a medicine that does not
 * exist. One mis-tap and a pharmacy is advertising the wrong drug.
 *
 * At 0.65 that pairing is gone, while the mistakes this is actually for —
 * "Paracetemol", "Metfomin" — score around 0.8 and survive. Offering
 * nothing is a fine outcome here; the owner can search for it by hand.
 */
const SUGGEST_THRESHOLD = 0.65

function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const pairs = (s: string) => {
    const out = new Map<string, number>()
    for (let i = 0; i < s.length - 1; i++) {
      const p = s.slice(i, i + 2)
      out.set(p, (out.get(p) ?? 0) + 1)
    }
    return out
  }
  const pa = pairs(a)
  const pb = pairs(b)
  let hits = 0
  let total = 0
  for (const [, n] of pa) total += n
  for (const [, n] of pb) total += n
  for (const [p, n] of pa) {
    const m = pb.get(p)
    if (m) hits += Math.min(n, m)
  }
  return (2 * hits) / total
}

function candidate(d: CatalogueDrug, via: DrugCandidate['via']): DrugCandidate {
  return { id: d.id, genericName: d.genericName, strength: d.strength, form: d.form, via }
}

/**
 * Resolves one row against the catalogue.
 *
 * Strength and form act as filters, not as tie-breakers: when the file
 * states one and a drug disagrees, that drug is out. A single survivor is
 * a match; several is the owner's decision; none is unmatched with a
 * shortlist attached.
 */
function resolve(
  name: string,
  strength: string,
  form: string,
  brand: string,
  catalogue: CatalogueDrug[],
  byStockedBrand: Map<string, string[]>,
): { status: Exclude<RowStatus, 'duplicate'>; drugId?: string; candidates: DrugCandidate[]; reason?: string } {
  const combined = [name, strength, form, brand].filter(Boolean).join(' ')
  const wantStrength = normStrength(strength) || strengthFromText(combined)
  const wantForm = (formFromText(form) || formFromText(combined)) as DrugFormValue | ''
  const core = nameCore(name) || normName(name)

  if (!core) return { status: 'invalid', candidates: [], reason: 'No medicine name in this row' }

  const agrees = (d: CatalogueDrug) =>
    (!wantStrength || normStrength(d.strength) === wantStrength) &&
    (!wantForm || d.form === wantForm)

  // 1. The generic name, as written.
  let pool = catalogue.filter((d) => normName(d.genericName) === core)
  let via: DrugCandidate['via'] = 'name'

  // 2. A brand name the catalogue already knows.
  if (pool.length === 0) {
    const brandKeys = [core, normName(brand)].filter(Boolean)
    pool = catalogue.filter((d) => d.brandNames.some((b) => brandKeys.includes(normName(b))))
    via = 'brand'
  }

  // 3. A brand some pharmacy registered against its own stock — the name
  //    on the box, which is often the only name in the file.
  if (pool.length === 0) {
    const ids = new Set(
      [core, normName(brand)].filter(Boolean).flatMap((k) => byStockedBrand.get(k) ?? []),
    )
    pool = catalogue.filter((d) => ids.has(d.id))
    via = 'stocked-brand'
  }

  if (pool.length > 0) {
    const agreed = pool.filter(agrees)
    if (agreed.length === 1) return { status: 'matched', drugId: agreed[0].id, candidates: [candidate(agreed[0], via)] }
    if (agreed.length > 1) {
      return {
        status: 'ambiguous',
        candidates: agreed.slice(0, 6).map((d) => candidate(d, via)),
        reason: 'Several strengths or forms fit — pick the one on your shelf',
      }
    }
    // The name is known but nothing agrees on strength or form. This is the
    // case worth being loudest about: it is exactly where an eager matcher
    // would hand back the wrong box.
    return {
      status: 'unmatched',
      candidates: pool.slice(0, 6).map((d) => candidate(d, via)),
      reason: wantStrength
        ? `We have this medicine, but not at ${strength || wantStrength}`
        : 'We have this medicine, but not in that form',
    }
  }

  // 4. Nothing matched by name at all — offer a shortlist, choose nothing.
  const scored = catalogue
    .map((d) => ({ d, score: similarity(core, normName(d.genericName)) }))
    .filter((x) => x.score > SUGGEST_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  return {
    status: 'unmatched',
    candidates: scored.map((x) => candidate(x.d, 'similar')),
    reason: scored.length ? 'Not sure which medicine this is' : 'No medicine in our list matches this',
  }
}

/* ------------------------------------------------------------------ entry */

export async function buildPreview(table: CsvTable): Promise<ImportPreview> {
  const cols = mapColumns(table.headers)
  const recognised = (Object.keys(cols) as ImportField[]).filter((f) => cols[f] !== -1)
  const usedIndexes = new Set(recognised.map((f) => cols[f]))
  const ignoredHeaders = table.headers.filter((_, i) => !usedIndexes.has(i) && table.headers[i] !== '')

  const cell = (row: string[], field: ImportField) => (cols[field] === -1 ? '' : (row[cols[field]] ?? ''))

  // The whole catalogue in one query, then matched in memory. 2000 rows
  // against per-row queries would be 2000 round trips; the catalogue is a
  // few thousand short rows and is the same for every one of them.
  const catalogue = await prisma.drug.findMany({
    select: { id: true, genericName: true, brandNames: true, strength: true, form: true },
  })

  // Stocked brands, looked up only for the names this file actually uses,
  // so the size of this query is bounded by the file rather than by how
  // many pharmacies have signed up.
  const wanted = new Set<string>()
  for (const row of table.rows) {
    const n = nameCore(cell(row, 'name')) || normName(cell(row, 'name'))
    if (n) wanted.add(n)
    const b = normName(cell(row, 'brand'))
    if (b) wanted.add(b)
  }
  const byStockedBrand = new Map<string, string[]>()
  if (wanted.size > 0) {
    const stocked = await prisma.pharmacyInventory.findMany({
      where: { brand: { not: null } },
      select: { brand: true, drugId: true },
      distinct: ['brand', 'drugId'],
    })
    for (const s of stocked) {
      const key = normName(s.brand!)
      if (!wanted.has(key)) continue
      const list = byStockedBrand.get(key) ?? []
      list.push(s.drugId)
      byStockedBrand.set(key, list)
    }
  }

  const seen = new Set<string>()
  const rows: ImportRow[] = table.rows.map((row, i) => {
    const source = {
      name: cell(row, 'name'),
      strength: cell(row, 'strength'),
      form: cell(row, 'form'),
      brand: cell(row, 'brand'),
    }
    const quantity = parseQuantity(cell(row, 'quantity'))
    const base = {
      // +2: one for the header row, one because people count from 1.
      line: i + 2,
      source,
      quantity,
      brand: source.brand.trim() ? source.brand.trim().slice(0, 120) : null,
      expiryDate: parseExpiry(cell(row, 'expiry')),
      inStock: parseInStock(cell(row, 'inStock'), quantity),
    }

    const r = resolve(source.name, source.strength, source.form, source.brand, catalogue, byStockedBrand)

    // A file listing the same medicine twice would otherwise apply both,
    // last one silently winning. Say so instead.
    if (r.status === 'matched' && r.drugId) {
      if (seen.has(r.drugId)) {
        return { ...base, status: 'duplicate' as const, candidates: r.candidates, reason: 'Already listed higher up in this file' }
      }
      seen.add(r.drugId)
    }
    return { ...base, ...r }
  })

  const counts = { matched: 0, ambiguous: 0, unmatched: 0, invalid: 0, duplicate: 0 } as Record<RowStatus, number>
  for (const r of rows) counts[r.status]++

  return { rows, counts, recognised, ignoredHeaders }
}
