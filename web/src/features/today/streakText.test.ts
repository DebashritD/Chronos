import { describe, expect, it } from 'vitest'
import { streakText } from './streakText'

describe('streakText', () => {
  it('names the unit for daily and weekly habits', () => {
    expect(streakText('DAILY', 12)).toEqual({ count: 12, rest: 'days unbroken' })
    expect(streakText('DAILY', 1)).toEqual({ count: 1, rest: 'day unbroken' })
    expect(streakText('WEEKLY', 6)).toEqual({ count: 6, rest: 'weeks unbroken' })
    expect(streakText('WEEKLY', 1)).toEqual({ count: 1, rest: 'week unbroken' })
  })
  it('counts every-N-days periods in a row', () => {
    expect(streakText('EVERY_N_DAYS', 4)).toEqual({ count: 4, rest: 'in a row' })
  })
  it('calls a zero streak a fresh start', () => {
    expect(streakText('DAILY', 0)).toEqual({ count: null, rest: 'Fresh start' })
  })
})
