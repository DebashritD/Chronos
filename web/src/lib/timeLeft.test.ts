import { describe, expect, it } from 'vitest'
import { formatTimeLeft, isUrgent } from './timeLeft'

const now = new Date('2026-11-18T06:30:00Z')

describe('formatTimeLeft', () => {
  it('counts hours for daily habits', () => {
    expect(formatTimeLeft('2026-11-18T18:30:00Z', now, 'DAILY')).toBe('12h left today')
    expect(formatTimeLeft('2026-11-19T06:30:00Z', now, 'DAILY')).toBe('24h left today')
  })

  it('counts days and hours for longer periods', () => {
    expect(formatTimeLeft('2026-11-19T18:30:00Z', now, 'EVERY_N_DAYS')).toBe('1d 12h left in this period')
    expect(formatTimeLeft('2026-11-19T02:30:00Z', now, 'EVERY_N_DAYS')).toBe('20h left in this period')
    expect(formatTimeLeft('2026-11-22T18:30:00Z', now, 'WEEKLY')).toBe('4d 12h left this week')
  })

  it('switches to hours and minutes in the last three hours', () => {
    expect(formatTimeLeft('2026-11-18T09:10:00Z', now, 'WEEKLY')).toBe('2h 40m left')
    expect(formatTimeLeft('2026-11-18T09:30:00Z', now, 'DAILY')).toBe('3h left today')
  })

  it('shows minutes in the last hour', () => {
    expect(formatTimeLeft('2026-11-18T07:10:00Z', now, 'DAILY')).toBe('40m left')
    expect(formatTimeLeft('2026-11-18T06:30:30Z', now, 'DAILY')).toBe('1m left')
  })

  it('returns null once the period has closed', () => {
    expect(formatTimeLeft('2026-11-18T06:30:00Z', now, 'DAILY')).toBeNull()
    expect(formatTimeLeft('2026-11-17T18:30:00Z', now, 'DAILY')).toBeNull()
  })
})

describe('isUrgent', () => {
  it('is true only with less than three hours left', () => {
    expect(isUrgent('2026-11-18T09:10:00Z', now)).toBe(true)
    expect(isUrgent('2026-11-18T09:30:00Z', now)).toBe(false)
    expect(isUrgent('2026-11-18T18:30:00Z', now)).toBe(false)
    expect(isUrgent('2026-11-18T06:00:00Z', now)).toBe(false)
  })
})
