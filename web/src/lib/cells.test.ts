import { describe, expect, it } from 'vitest'
import { habitSummary, isColor } from './cells'

describe('cells', () => {
  it('summarises a habit as frequency · minimum → target', () => {
    expect(habitSummary({ frequency: 'DAILY', minText: '1 page', targetText: '20 pages' })).toBe('Daily · 1 page → 20 pages')
    expect(habitSummary({ frequency: 'EVERY_N_DAYS', intervalDays: 3, minText: '1 km', targetText: '5 km' })).toBe(
      'Every 3 days · 1 km → 5 km',
    )
    expect(habitSummary({ frequency: 'WEEKLY', minText: '5 min', targetText: '30 min' })).toBe('Weekly · 5 min → 30 min')
  })

  it('knows which states are marked colors', () => {
    expect(isColor('YELLOW')).toBe(true)
    expect(isColor('PENDING')).toBe(false)
    expect(isColor('GREY')).toBe(false)
  })
})
