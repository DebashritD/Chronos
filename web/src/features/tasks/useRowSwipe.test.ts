import { describe, expect, it } from 'vitest'
import { swipeOutcome } from './useRowSwipe'

describe('swipeOutcome', () => {
  it('moves to Later past a quarter, deletes past 60%, ignores rightward', () => {
    expect(swipeOutcome(-50, 400, false)).toBe('none')
    expect(swipeOutcome(-120, 400, false)).toBe('later')
    expect(swipeOutcome(-260, 400, false)).toBe('delete')
    expect(swipeOutcome(120, 400, false)).toBe('none')
  })
  it('only deletes on a Later row', () => {
    expect(swipeOutcome(-120, 400, true)).toBe('delete')
  })
})
