import { describe, expect, it } from 'vitest'
import type { Habit, WeekHabit, WeekView } from '../../api/types'
import { localTodayWeek, periodContaining } from './localTodayWeek'

const TZ = 'Asia/Kolkata'
const THU = new Date('2026-11-19T06:30:00Z') // 12:00 IST, Thursday 19 Nov
const NEXT_MON = new Date('2026-11-23T06:30:00Z') // 12:00 IST, Monday 23 Nov

function habit(id: number, over: Partial<Habit>): Habit {
  return { id, name: `H${id}`, minText: 'min', targetText: 'target', frequency: 'DAILY', startDate: '2026-11-01',
    status: 'ACTIVE', yellowCap: true, ...over }
}

function row(h: Habit, current: WeekHabit['current']): WeekHabit {
  return { id: h.id, name: h.name, minText: h.minText, targetText: h.targetText, frequency: h.frequency,
    intervalDays: h.intervalDays ?? null, status: h.status, current, cells: [] }
}

const daily = habit(1, {})
const everyThree = habit(2, { frequency: 'EVERY_N_DAYS', intervalDays: 3, startDate: '2026-11-02' }) // 17–19 Nov
const weekly = habit(3, { frequency: 'WEEKLY', startDate: '2026-11-04' }) // Monday 2 Nov is the first period
const later = habit(4, { startDate: '2026-11-20' })
const paused = habit(5, { status: 'PAUSED' })
const habits = [daily, everyThree, weekly, later, paused]

const week: WeekView = {
  start: '2026-11-16',
  today: '2026-11-18',
  distribution: { green: 0, yellow: 0, red: 0, grey: 0, total: 0 },
  habits: [
    row(daily, { periodStart: '2026-11-18', state: 'GREEN', editable: true, note: 'old', closesAt: '2026-11-18T18:30:00Z' }),
    row(everyThree, { periodStart: '2026-11-17', state: 'YELLOW', editable: true, note: 'mid', closesAt: '2026-11-19T18:30:00Z' }),
    row(weekly, { periodStart: '2026-11-16', state: 'GREEN', editable: true, note: null, closesAt: '2026-11-22T18:30:00Z' }),
    row(later, null),
    row(paused, { periodStart: '2026-11-18', state: 'PAUSED', editable: false, note: null, closesAt: '2026-11-18T18:30:00Z' }),
  ],
}

const currentOf = (view: WeekView, id: number) => view.habits.find((h) => h.id === id)?.current

describe('periodContaining', () => {
  it('mirrors HabitSchedule for each frequency', () => {
    expect(periodContaining(daily, '2026-11-19')).toBe('2026-11-19')
    expect(periodContaining(everyThree, '2026-11-19')).toBe('2026-11-17')
    expect(periodContaining(everyThree, '2026-11-20')).toBe('2026-11-20')
    expect(periodContaining(weekly, '2026-11-22')).toBe('2026-11-16')
    expect(periodContaining(weekly, '2026-11-02')).toBe('2026-11-02') // before startDate, but in its first week
    expect(periodContaining(weekly, '2026-11-01')).toBeNull()
    expect(periodContaining(later, '2026-11-19')).toBeNull()
  })
})

describe('localTodayWeek', () => {
  it('returns the saved week unchanged on the same day or before habits load', () => {
    const sameDay = new Date('2026-11-18T06:30:00Z')
    expect(localTodayWeek(week, habits, TZ, sameDay)).toBe(week)
    expect(localTodayWeek(week, undefined, TZ, THU)).toBe(week)
  })

  it('starts a fresh daily period on a new day', () => {
    const view = localTodayWeek(week, habits, TZ, THU)
    expect(view.today).toBe('2026-11-19')
    expect(currentOf(view, 1)).toEqual({ periodStart: '2026-11-19', state: 'PENDING', editable: true, note: null,
      closesAt: '2026-11-19T18:30:00Z' })
  })

  it('keeps an unchanged every-N or weekly period as saved', () => {
    const view = localTodayWeek(week, habits, TZ, THU)
    expect(currentOf(view, 2)).toEqual({ periodStart: '2026-11-17', state: 'YELLOW', editable: true, note: 'mid',
      closesAt: '2026-11-19T18:30:00Z' })
    expect(currentOf(view, 3)).toMatchObject({ periodStart: '2026-11-16', state: 'GREEN' })
  })

  it('starts the next weekly period in a new week', () => {
    const view = localTodayWeek(week, habits, TZ, NEXT_MON)
    expect(view.today).toBe('2026-11-23')
    expect(currentOf(view, 3)).toEqual({ periodStart: '2026-11-23', state: 'PENDING', editable: true, note: null,
      closesAt: '2026-11-29T18:30:00Z' })
    expect(currentOf(view, 2)).toMatchObject({ periodStart: '2026-11-23', state: 'PENDING' })
  })

  it('has no current period before the habit starts, and leaves paused habits out', () => {
    const view = localTodayWeek(week, habits, TZ, THU)
    expect(currentOf(view, 4)).toBeNull()
    expect(view.habits.map((h) => h.id)).toEqual([1, 2, 3, 4])
  })

  it('computes closesAt in a non-UTC timezone', () => {
    const ny = { ...week, today: '2026-11-18' }
    const view = localTodayWeek(ny, [daily], 'America/New_York', new Date('2026-11-19T15:00:00Z'))
    expect(currentOf(view, 1)?.closesAt).toBe('2026-11-20T05:00:00Z')
  })

  it('includes an active habit missing from the saved week with no cells', () => {
    const fresh = habit(9, { name: 'New' })
    const view = localTodayWeek(week, [fresh], TZ, THU)
    expect(view.habits).toEqual([{ id: 9, name: 'New', minText: 'min', targetText: 'target', frequency: 'DAILY',
      intervalDays: null, status: 'ACTIVE', cells: [],
      current: { periodStart: '2026-11-19', state: 'PENDING', editable: true, note: null, closesAt: '2026-11-19T18:30:00Z' } }])
  })
})
