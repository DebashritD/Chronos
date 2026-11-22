import { describe, expect, it } from 'vitest'
import { isColor } from './cells'

describe('cells', () => {
  it('knows which states are marked colors', () => {
    expect(isColor('YELLOW')).toBe(true)
    expect(isColor('PENDING')).toBe(false)
    expect(isColor('GREY')).toBe(false)
  })
})
