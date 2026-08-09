/**
 * Turning what somebody typed at a counter into an intent.
 *
 * Kept free of Prisma and of `next/server` so the whole grammar can be
 * exercised without a webhook or a database — this is the layer where a
 * misread message becomes a wrong claim about a shelf, so it is the layer
 * that most needs to be testable on its own.
 */

export const BUTTON_CONFIRM_ALL = 'CONFIRM_ALL_STOCK'
export const BUTTON_OUT_PREFIX = 'OUT_OF_STOCK_'
export const BUTTON_IN_PREFIX = 'IN_STOCK_'

export type Command =
  | { kind: 'confirm-all' }
  | { kind: 'set-out'; inventoryId: string }
  | { kind: 'set-in'; inventoryId: string }
  | { kind: 'stock'; name: string; quantity: number }
  | { kind: 'out'; name: string }
  | { kind: 'help' }
  /** Anything else — handed to the fuzzy match, which asks before acting. */
  | { kind: 'search'; text: string }
  | { kind: 'ignore' }

/** Buttons carry the whole intent in their id; nothing is parsed from the label. */
export function parseButtonId(id: string): Command {
  if (id === BUTTON_CONFIRM_ALL) return { kind: 'confirm-all' }
  if (id.startsWith(BUTTON_OUT_PREFIX)) {
    const inventoryId = id.slice(BUTTON_OUT_PREFIX.length)
    return inventoryId ? { kind: 'set-out', inventoryId } : { kind: 'ignore' }
  }
  if (id.startsWith(BUTTON_IN_PREFIX)) {
    const inventoryId = id.slice(BUTTON_IN_PREFIX.length)
    return inventoryId ? { kind: 'set-in', inventoryId } : { kind: 'ignore' }
  }
  return { kind: 'ignore' }
}

/** Beyond this, somebody has typed a phone number into the quantity box. */
const MAX_QUANTITY = 100_000

// No `s` flag: `.` stopping at a newline is wanted here, so a command with
// a stray second line acts on the first and ignores the rest rather than
// swallowing it into the drug name.
const SLASH = /^\/(stock|out|help)\b\s*(.*)$/i

/**
 * A slash command, or free text to be looked up.
 *
 * `/stock <name> <qty>` takes the quantity from the LAST whitespace-
 * separated token, and only if that token is a bare integer. Names carry
 * digits of their own — "amoxicillin 500mg 12" has to come out as twelve
 * of the 500mg, not five hundred of something called "amoxicillin".
 */
export function parseMessage(raw: string): Command {
  const text = raw.trim()
  if (!text) return { kind: 'ignore' }

  const slash = SLASH.exec(text)
  if (!slash) return { kind: 'search', text }

  const verb = slash[1].toLowerCase()
  const rest = slash[2].trim()

  if (verb === 'help') return { kind: 'help' }
  if (!rest) return { kind: 'help' }

  if (verb === 'out') return { kind: 'out', name: rest }

  const parts = rest.split(/\s+/)
  const last = parts[parts.length - 1]
  if (parts.length < 2 || !/^\d+$/.test(last)) return { kind: 'help' }

  const quantity = Number(last)
  if (!Number.isSafeInteger(quantity) || quantity > MAX_QUANTITY) return { kind: 'help' }

  const name = parts.slice(0, -1).join(' ')
  if (!name) return { kind: 'help' }

  // "/stock X 0" is not a stock update, it is an out-of-stock report.
  // Writing quantity 0 while leaving inStock true would put a claim on the
  // shelf that the same message denies.
  if (quantity === 0) return { kind: 'out', name }

  return { kind: 'stock', name, quantity }
}

/**
 * Meta hands the sender's number as bare digits ("2348031234567"); staff
 * numbers are stored E.164 the way lib/auth normalises everything else.
 */
export function whatsappFromToE164(from: string): string {
  const digits = from.replace(/\D/g, '')
  if (!digits) return ''
  return `+${digits}`
}

export type MatchableItem = {
  inventoryId: string
  genericName: string
  brandNames: string[]
  strength: string
  form: string
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * True when what somebody typed names this item's strength.
 *
 * Both "amoxicillin 250 mg" and "amoxicillin 250" count. The bare number
 * has to, because that is how people write it and because the ambiguity
 * reply asks them to add the strength — a prompt that only accepted one
 * spelling of the answer would be worse than not asking.
 */
function mentionsStrength(normalisedQuery: string, strength: string): boolean {
  const s = normalise(strength)
  if (!s) return false
  if (normalisedQuery.includes(s)) return true
  const digits = s.match(/\d+/)?.[0]
  return digits ? normalisedQuery.split(' ').includes(digits) : false
}

/**
 * Ranks a pharmacy's own listings against what somebody typed.
 *
 * Scoped to what the shop already stocks, never the whole catalogue: the
 * only thing a staff member can say anything true about is their own
 * shelf, and matching against 8,000 drugs would invite them to mark
 * something "out" that they never carried.
 *
 * A stated strength is a filter, not a hint. Someone who writes
 * "amoxicillin 250 mg" has told you which of the two they mean, and
 * offering them the 500 anyway would be ignoring the one word they added
 * to be unambiguous. Only when no listing matches the strength does it
 * fall back to every candidate.
 *
 * Name ordering, best first:
 *   4  the generic name, exactly
 *   3  a brand name, exactly
 *   2  the typed text starts the name ("amox" → Amoxicillin)
 *   1  the name appears anywhere in what they typed, or the reverse
 * Ties break on the shorter name, so "Amoxicillin" wins over
 * "Amoxicillin + Clavulanate" for a bare "amoxicillin".
 */
export function rankMatches(query: string, items: MatchableItem[]): MatchableItem[] {
  const q = normalise(query)
  if (!q) return []

  const scored = items
    .map((item) => {
      const strengthHit = mentionsStrength(q, item.strength)
      // Score the name against what is left once the strength is taken
      // out, or "amoxicillin 250 mg" would never look like "amoxicillin".
      const nameQ = strengthHit
        ? q
            .replace(normalise(item.strength), ' ')
            .replace(/\b\d+\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        : q
      const generic = normalise(item.genericName)
      const brands = item.brandNames.map(normalise)
      let score = 0
      if (!nameQ) score = strengthHit ? 1 : 0
      else if (generic === nameQ) score = 4
      else if (brands.includes(nameQ)) score = 3
      else if (generic.startsWith(nameQ) || brands.some((b) => b.startsWith(nameQ))) score = 2
      else if (
        generic.includes(nameQ) ||
        nameQ.includes(generic) ||
        brands.some((b) => b.includes(nameQ) || nameQ.includes(b))
      )
        score = 1
      return { item, score, strengthHit }
    })
    .filter((s) => s.score > 0)

  const exactStrength = scored.filter((s) => s.strengthHit)
  const pool = exactStrength.length > 0 ? exactStrength : scored

  pool.sort((a, b) => b.score - a.score || a.item.genericName.length - b.item.genericName.length)
  return pool.map((s) => s.item)
}

/** "Amoxicillin 500 mg (capsule)" — the same shape the web UI uses. */
export function itemLabel(item: MatchableItem): string {
  return `${item.genericName} ${item.strength} (${item.form.toLowerCase()})`
}

export const HELP_TEXT = [
  'MediQuest stock updates:',
  '',
  '/stock <medicine> <how many> — mark it in stock',
  '/out <medicine> — mark it out of stock',
  '',
  'Or just send a medicine name and I will ask which one you mean.',
].join('\n')
