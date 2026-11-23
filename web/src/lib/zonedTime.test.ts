import { describe, expect, it } from 'vitest'
import { startOfDayIn, todayIn } from './zonedTime'

describe('todayIn', () => {
  it('is the calendar date in the given zone', () => {
    expect(todayIn('Asia/Kolkata', new Date('2026-11-18T18:29:00Z'))).toBe('2026-11-18')
    expect(todayIn('Asia/Kolkata', new Date('2026-11-18T18:30:00Z'))).toBe('2026-11-19')
    expect(todayIn('America/New_York', new Date('2026-11-19T03:00:00Z'))).toBe('2026-11-18')
  })
})

describe('startOfDayIn', () => {
  it('is that day’s midnight as a UTC instant', () => {
    expect(startOfDayIn('2026-11-19', 'Asia/Kolkata')).toBe('2026-11-18T18:30:00Z')
    expect(startOfDayIn('2026-11-20', 'America/New_York')).toBe('2026-11-20T05:00:00Z')
    expect(startOfDayIn('2026-11-20', 'UTC')).toBe('2026-11-20T00:00:00Z')
  })

  it('follows daylight saving changes', () => {
    // DST in New York began on Sunday 8 March 2026.
    expect(startOfDayIn('2026-03-08', 'America/New_York')).toBe('2026-03-08T05:00:00Z')
    expect(startOfDayIn('2026-03-09', 'America/New_York')).toBe('2026-03-09T04:00:00Z')
  })
})
