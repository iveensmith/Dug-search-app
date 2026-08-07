/**
 * Shared pagination for list endpoints, so they all read the same way from
 * the client's side.
 *
 * Two flavours, picked per endpoint by how the list behaves rather than by
 * preference:
 *
 * - Cursor, for feeds: prescriptions, reservations, chat messages, search
 *   history. New rows land at the front constantly, and OFFSET on a moving
 *   list either repeats or skips items as you page. A cursor is anchored to
 *   a row, so it can't drift. No total, because counting a growing feed on
 *   every page costs a scan for a number nobody acts on.
 *
 * - Offset, for admin tables and the owner's stock list: they're browsed
 *   rather than followed, they change slowly, and "1,204 drugs" is worth
 *   showing. Deep pages get slower — Postgres still walks the skipped rows
 *   — which is fine for a few thousand rows behind an admin login and would
 *   not be for a public feed.
 */
export const DEFAULT_PAGE_SIZE = 20

/** Nothing may ask for an unbounded page; that is the bug being fixed. */
export const MAX_PAGE_SIZE = 100

function pageSize(raw: string | null): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_PAGE_SIZE
  return Math.min(Math.trunc(n), MAX_PAGE_SIZE)
}

export type CursorPage = { take: number; cursorArgs: { cursor: { id: string }; skip: 1 } | object }

/**
 * Reads ?limit= and ?cursor= for a feed. Fetch `take` rows with
 * `...cursorArgs` spread into the query, then hand the result to
 * `cursorResult`.
 */
export function cursorPage(searchParams: URLSearchParams): CursorPage {
  const cursor = searchParams.get('cursor')
  return {
    take: pageSize(searchParams.get('limit')),
    // skip: 1 steps past the cursor row itself, which the client already has
    cursorArgs: cursor ? { cursor: { id: cursor }, skip: 1 } : {},
  }
}

/**
 * Trims the page to size and reports where the next one starts. Call the
 * query with `take + 1` — the extra row is how we know there is more
 * without a second count query.
 */
export function cursorResult<T extends { id: string }>(rows: T[], take: number) {
  const hasMore = rows.length > take
  const items = hasMore ? rows.slice(0, take) : rows
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null }
}

/** Reads ?limit= and ?page= (1-based) for a browsable table. */
export function offsetPage(searchParams: URLSearchParams) {
  const take = pageSize(searchParams.get('limit'))
  const raw = Number(searchParams.get('page'))
  const page = Number.isFinite(raw) && raw >= 1 ? Math.trunc(raw) : 1
  return { take, skip: (page - 1) * take, page }
}

export function offsetResult<T>(items: T[], total: number, { take, page }: { take: number; page: number }) {
  return { items, total, page, pageSize: take, hasMore: page * take < total }
}
