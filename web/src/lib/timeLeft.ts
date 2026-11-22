import type { Frequency } from '../api/types'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const URGENT = 3 * HOUR

const SUFFIX: Record<Frequency, string> = {
  DAILY: 'left today',
  EVERY_N_DAYS: 'left in this period',
  WEEKLY: 'left this week',
}

/**
 * Countdown text until the period closes (`closesAt`, an ISO instant from the API), or null once it has passed.
 * This is a nudge, not a lock: closed periods stay editable for 7 days (the API decides).
 */
export function formatTimeLeft(closesAt: string, now: Date, frequency: Frequency): string | null {
  const ms = Date.parse(closesAt) - now.getTime()
  if (ms <= 0) return null
  if (ms < HOUR) return `${Math.max(1, Math.floor(ms / MINUTE))}m left`
  if (ms < URGENT) return `${Math.floor(ms / HOUR)}h ${Math.floor((ms % HOUR) / MINUTE)}m left`
  const days = Math.floor(ms / DAY)
  const text = frequency === 'DAILY' || days === 0
    ? `${Math.floor(ms / HOUR)}h`
    : `${days}d ${Math.floor((ms % DAY) / HOUR)}h`
  return `${text} ${SUFFIX[frequency]}`
}

export function isUrgent(closesAt: string, now: Date): boolean {
  const ms = Date.parse(closesAt) - now.getTime()
  return ms > 0 && ms < URGENT
}
