import type { Frequency } from '../../api/types'

/** The streak line's words: "12 days unbroken", "6 weeks unbroken", "4 in a row", or "Fresh start". */
export function streakText(frequency: Frequency, streak: number): { count: number | null; rest: string } {
  if (streak <= 0) return { count: null, rest: 'Fresh start' }
  if (frequency === 'EVERY_N_DAYS') return { count: streak, rest: 'in a row' }
  const unit = frequency === 'DAILY' ? 'day' : 'week'
  return { count: streak, rest: `${unit}${streak === 1 ? '' : 's'} unbroken` }
}
