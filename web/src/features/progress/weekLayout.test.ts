import { describe, expect, it } from 'vitest'
import type { CurrentPeriod, WeekCell, WeekHabit } from '../../api/types'
import { weekSegments } from './weekLayout'

const START = '2026-11-16'

function cell(date: string, periodStart: string | null, state: WeekCell['state'] = 'PENDING'): WeekCell {
  return { date, periodStart, state: periodStart ? state : 'NOT_DUE', editable: periodStart !== null, note: null, closesAt: null }
}

function everyN(n: number, starts: string[], current: CurrentPeriod | null = null): WeekHabit {
  const cells = Array.from({ length: 7 }, (_, i) => {
    const date = `2026-11-${16 + i}`
    return cell(date, starts.includes(date) ? date : null)
  })
  return { id: 1, name: 'Run', minText: '1 km', targetText: '5 km', frequency: 'EVERY_N_DAYS', intervalDays: n,
    status: 'ACTIVE', current, cells }
}

const shape = (habit: WeekHabit) => weekSegments(habit, START).map(({ col, span, cell: c }) => [col, span, c?.periodStart ?? null])

describe('weekSegments', () => {
  it('gives every-N-days periods one bar each, clipped at the week end', () => {
    // Periods 17–19, 20–22, 23–25: the third starts next week.
    expect(shape(everyN(3, ['2026-11-17', '2026-11-20']))).toEqual([
      [0, 1, null],
      [1, 3, '2026-11-17'],
      [4, 3, '2026-11-20'],
    ])
  })

  it('fills the leading days with the current period when it began last week', () => {
    const current: CurrentPeriod = { periodStart: '2026-11-15', state: 'YELLOW', editable: true, note: null,
      closesAt: '2026-11-21T18:30:00Z' }
    expect(shape(everyN(7, ['2026-11-22'], current))).toEqual([
      [0, 6, '2026-11-15'],
      [6, 1, '2026-11-22'],
    ])
  })

  it('leaves leading days empty when their period is not the current one', () => {
    expect(shape(everyN(7, ['2026-11-22']))).toEqual([[0, 6, null], [6, 1, '2026-11-22']])
  })
})
