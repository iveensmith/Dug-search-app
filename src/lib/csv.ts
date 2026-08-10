/**
 * A CSV parser, written here rather than pulled in.
 *
 * The files this has to survive are not clean. They come out of a POS
 * export, a spreadsheet saved on a Windows machine, or a phone typing
 * into Google Sheets: a UTF-8 BOM on the front, CRLF line endings,
 * semicolons instead of commas, quoted product names containing commas,
 * and a trailing blank line. A split on "," handles none of that and
 * fails silently — a quoted "Amoxicillin, 625mg" becomes two columns and
 * every field after it shifts by one, which shows up as wrong medicines
 * against wrong quantities rather than as an error.
 *
 * Deliberately small: this parses, and nothing more. Deciding what the
 * columns mean is lib/inventoryImport's job.
 */

/** Rejected before parsing, so a pasted novel cannot hang a function. */
export const MAX_CSV_BYTES = 1024 * 1024
export const MAX_CSV_ROWS = 2000

export type CsvTable = {
  headers: string[]
  /** Row values, aligned to `headers` by position; short rows are padded. */
  rows: string[][]
}

/**
 * Which character separates fields.
 *
 * Excel on a machine with a comma decimal separator writes semicolons,
 * which is common enough that guessing wrong turns every row into a
 * single unparsable column. Counted on the header line only — the first
 * line is the one least likely to contain free text with stray
 * punctuation.
 */
function detectDelimiter(firstLine: string): string {
  const candidates = [',', ';', '\t', '|']
  let best = ','
  let bestCount = 0
  for (const d of candidates) {
    // Count only outside quotes, so a quoted "Paracetamol, 500mg" header
    // does not vote for the comma.
    let count = 0
    let inQuotes = false
    for (let i = 0; i < firstLine.length; i++) {
      const c = firstLine[i]
      if (c === '"') inQuotes = !inQuotes
      else if (c === d && !inQuotes) count++
    }
    if (count > bestCount) {
      bestCount = count
      best = d
    }
  }
  return best
}

/**
 * Splits the text into rows of fields.
 *
 * Handles quoted fields containing the delimiter, newlines inside quotes,
 * and the doubled-quote escape ("" for a literal quote) — all three occur
 * in real exports, and all three corrupt a naive split without raising
 * anything.
 */
function splitRecords(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const c = text[i]

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }

    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === delimiter) {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\r') {
      // Swallow CRLF as one break; a lone CR is an old-Mac line ending.
      if (text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += c
    i++
  }

  // Whatever is left when the text runs out is the last field, unless the
  // file simply ended with a newline.
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export type CsvParseResult =
  | { ok: true; table: CsvTable }
  | { ok: false; error: string }

export function parseCsv(text: string): CsvParseResult {
  // A UTF-8 BOM survives into the first header name, so "Drug" arrives as
  // "﻿Drug" and never matches an alias. Excel writes one by default.
  const clean = text.replace(/^﻿/, '')
  if (!clean.trim()) return { ok: false, error: 'That file is empty.' }

  const firstLineEnd = clean.search(/\r?\n/)
  const firstLine = firstLineEnd === -1 ? clean : clean.slice(0, firstLineEnd)
  const delimiter = detectDelimiter(firstLine)

  const records = splitRecords(clean, delimiter).filter(
    // Drop blank lines — a trailing newline, or a spacer row someone left
    // in the spreadsheet.
    (r) => r.some((f) => f.trim() !== ''),
  )
  if (records.length === 0) return { ok: false, error: 'That file is empty.' }

  const headers = records[0].map((h) => h.trim())
  if (headers.every((h) => h === '')) {
    return { ok: false, error: 'The first row should name the columns.' }
  }

  const body = records.slice(1)
  if (body.length === 0) {
    return { ok: false, error: 'That file has column names but no rows under them.' }
  }
  if (body.length > MAX_CSV_ROWS) {
    return {
      ok: false,
      error: `That file has ${body.length} rows — the most that can be imported at once is ${MAX_CSV_ROWS}. Split it and import in parts.`,
    }
  }

  // Padded so a short row reads as empty cells rather than undefined, and
  // so every row can be indexed by header position without a length check.
  const rows = body.map((r) => {
    const padded = headers.map((_, i) => (r[i] ?? '').trim())
    return padded
  })

  return { ok: true, table: { headers, rows } }
}

/* ------------------------------------------------------- column meanings */

/**
 * What a column has to be called to be understood.
 *
 * Nobody is going to rename their export's headers to match ours, so the
 * aliases are the ones real inventory exports and spreadsheets actually
 * use. Matching is case- and punctuation-insensitive, so "Drug Name",
 * "drug_name" and "DRUGNAME" are the same column.
 *
 * Note what is *not* here: "manufacturer" is not an alias for brand. They
 * are different facts, and quietly filing Emzor as the brand of a drug
 * they merely made would put a wrong name on a patient's screen.
 */
const COLUMN_ALIASES: Record<ImportField, string[]> = {
  name: ['drug', 'drugname', 'name', 'product', 'productname', 'item', 'itemname', 'description', 'medicine', 'generic', 'genericname'],
  strength: ['strength', 'dose', 'dosage', 'mg', 'power'],
  form: ['form', 'dosageform', 'type', 'presentation'],
  brand: ['brand', 'brandname', 'tradename'],
  quantity: ['quantity', 'qty', 'stock', 'stockqty', 'count', 'units', 'onhand', 'quantityonhand', 'balance'],
  expiry: ['expiry', 'expirydate', 'exp', 'expires', 'expdate', 'bestbefore'],
  inStock: ['instock', 'available', 'status', 'stockstatus'],
}

export type ImportField = 'name' | 'strength' | 'form' | 'brand' | 'quantity' | 'expiry' | 'inStock'

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Maps each known field to the column index holding it, or -1.
 *
 * First match wins, so a file with both "generic name" and "product name"
 * uses whichever appears first rather than silently preferring one.
 */
export function mapColumns(headers: string[]): Record<ImportField, number> {
  const normalised = headers.map(normaliseHeader)
  const out = {} as Record<ImportField, number>

  for (const field of Object.keys(COLUMN_ALIASES) as ImportField[]) {
    out[field] = -1
    for (const alias of COLUMN_ALIASES[field]) {
      const i = normalised.indexOf(alias)
      if (i !== -1) {
        out[field] = i
        break
      }
    }
  }
  return out
}
