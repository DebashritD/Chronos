import { describe, expect, it } from 'vitest'
import type { WeekCell, WeekView } from '../../api/types'
import { patchWeek } from './patchWeek'

function cell(date: string, state: WeekCell['state'], note: string | null = null): WeekCell {
  return { date, periodStart: date, state, editable: true, note, closesAt: `${date}T18:30:00Z` }
}

const week: WeekView = {
  start: '2026-11-16',
  today: '2026-11-18',
  distribution: { green: 1, yellow: 0, red: 0, grey: 0, total: 1 },
  habits: [
    { id: 1, name: 'Read', minText: '1 page', targetText: '20 pages', frequency: 'DAILY', intervalDays: null,
      status: 'ACTIVE', cells: [cell('2026-11-17', 'GREEN', 'ch 2'), cell('2026-11-18', 'PENDING')],
      current: { periodStart: '2026-11-18', state: 'PENDING', editable: true, note: null, closesAt: '2026-11-18T18:30:00Z' } },
    { id: 2, name: 'Run', minText: '1 km', targetText: '5 km', frequency: 'DAILY', intervalDays: null,
      status: 'ACTIVE', cells: [cell('2026-11-18', 'PENDING')],
      current: { periodStart: '2026-11-18', state: 'PENDING', editable: true, note: null, closesAt: '2026-11-18T18:30:00Z' } },
  ],
}

describe('patchWeek', () => {
  it('saves a mark into the matching cell and current period only', () => {
    const next = patchWeek(week, { op: 'save', habitId: 1, periodStart: '2026-11-18', color: 'YELLOW', note: 'short' })
    const read = next.habits[0]
    expect(read.cells.map((c) => [c.state, c.note])).toEqual([['GREEN', 'ch 2'], ['YELLOW', 'short']])
    expect(read.current).toMatchObject({ periodStart: '2026-11-18', state: 'YELLOW', note: 'short' })
    expect(next.habits[1]).toBe(week.habits[1])
    expect(week.habits[0].current?.state).toBe('PENDING') // input untouched
  })

  it('saves into a past cell without touching the current period', () => {
    const next = patchWeek(week, { op: 'save', habitId: 1, periodStart: '2026-11-17', color: 'RED', note: null })
    expect(next.habits[0].cells[0]).toMatchObject({ state: 'RED', note: null })
    expect(next.habits[0].current).toBe(week.habits[0].current)
  })

  it('clears a mark back to pending with no note', () => {
    const marked = patchWeek(week, { op: 'save', habitId: 1, periodStart: '2026-11-18', color: 'GREEN', note: 'x' })
    const next = patchWeek(marked, { op: 'clear', habitId: 1, periodStart: '2026-11-18' })
    expect(next.habits[0].cells[1]).toMatchObject({ state: 'PENDING', note: null })
    expect(next.habits[0].current).toMatchObject({ state: 'PENDING', note: null })
  })

  it('moves current on to a newer period derived on the device', () => {
    const next = patchWeek(week, { op: 'save', habitId: 2, periodStart: '2026-11-19', color: 'GREEN', note: null })
    expect(next.habits[1].current).toMatchObject({ periodStart: '2026-11-19', state: 'GREEN', editable: true, note: null })
    expect(next.habits[1].cells).toEqual(week.habits[1].cells)
  })
})
