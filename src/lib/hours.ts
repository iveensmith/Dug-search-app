// Self-reported opening hours — same every day, no per-day overrides, no
// verification. Nigeria is UTC+1 (WAT) year-round with no DST, so "is it
// open now" is a plain "HH:mm" string comparison against the current time
// in Africa/Lagos — no timezone library needed.

export type HoursInfo = {
  open24h: boolean
  opensAt: string | null // "HH:mm", 24h
  closesAt: string | null
}

function currentHHmmInLagos(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date())
}

/** null = hours not set (pharmacy hasn't told us), true/false = actually open/closed now. */
export function isOpenNow({ open24h, opensAt, closesAt }: HoursInfo): boolean | null {
  if (open24h) return true
  if (!opensAt || !closesAt) return null

  const now = currentHHmmInLagos()
  // Overnight ranges (e.g. 20:00–06:00) wrap past midnight.
  if (closesAt < opensAt) return now >= opensAt || now < closesAt
  return now >= opensAt && now < closesAt
}
