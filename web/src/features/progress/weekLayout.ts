import type { WeekCell, WeekHabit } from '../../api/types'
import { addDays } from '../../lib/dates'

export function subtitle(habit: WeekHabit): string | null {
  if (habit.frequency === 'WEEKLY') return 'weekly'
  if (habit.frequency === 'EVERY_N_DAYS') return `every ${habit.intervalDays} days`
  return null
}

/** A run of `span` week columns from `col` (0 = Monday); `cell` is null for days we have no period for. */
export interface Segment {
  col: number
  span: number
  cell: WeekCell | null
  /** First and last day of the segment as shown (clipped to the week). */
  from: string
  to: string
}

/**
 * Lays a habit's week out as segments: one per day for DAILY, one for the whole week for WEEKLY, and one bar per
 * period for EVERY_N_DAYS (clipped to the week). Leading days of an every-N-days week belong to a period that began
 * earlier; that period is only known when it is the current one.
 */
export function weekSegments(habit: WeekHabit, start: string): Segment[] {
  const seg = (col: number, span: number, cell: WeekCell | null): Segment =>
    ({ col, span, cell, from: addDays(start, col), to: addDays(start, col + span - 1) })
  if (habit.frequency === 'WEEKLY') return habit.cells.slice(0, 1).map((cell) => seg(0, 7, cell))
  if (habit.frequency === 'DAILY') return habit.cells.map((cell, i) => seg(i, 1, cell))

  const n = habit.intervalDays ?? 1
  const segments: Segment[] = []
  const first = habit.cells.findIndex((cell) => cell.periodStart !== null)
  const lead = first === -1 ? 7 : first
  if (lead > 0) {
    const current = habit.current
    const coversLead = current !== null && current.periodStart < start && addDays(current.periodStart, n - 1) >= start
    segments.push(seg(0, lead, coversLead ? { date: current.periodStart, ...current } : null))
  }
  for (let i = lead; i < 7; ) {
    const cell = habit.cells[i]
    if (cell.periodStart === null) {
      segments.push(seg(i, 1, null))
      i += 1
      continue
    }
    const span = Math.min(n, 7 - i)
    segments.push(seg(i, span, cell))
    i += span
  }
  return segments
}
