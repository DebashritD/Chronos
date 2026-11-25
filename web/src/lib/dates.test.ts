import { describe, expect, it } from 'vitest'
import { addDays, addMonths, dayOfMonth, formatDay, formatLongDay, formatMonth, formatWeekRange, formatWeekday, weekdayIndex } from './dates'

describe('dates', () => {
  it('formats the weekday in full', () => {
    expect(formatWeekday('2026-11-25')).toBe('Wednesday')
  })

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04')
    expect(addDays('2026-11-16', -7)).toBe('2026-11-09')
  })

  it('adds months', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })

  it('numbers weekdays from Monday', () => {
    expect(weekdayIndex('2026-11-16')).toBe(0)
    expect(weekdayIndex('2026-11-22')).toBe(6)
    expect(weekdayIndex('2026-11-01')).toBe(6)
  })

  it('formats for display', () => {
    expect(dayOfMonth('2026-11-08')).toBe(8)
    expect(formatDay('2026-11-18')).toBe('Wed 18 Nov')
    expect(formatLongDay('2026-11-18')).toBe('Wednesday, 18 Nov')
    expect(formatWeekRange('2026-11-16')).toBe('16 – 22 Nov 2026')
    expect(formatWeekRange('2026-11-30')).toBe('30 Nov – 6 Dec 2026')
    expect(formatMonth('2026-11')).toBe('November 2026')
  })
})
