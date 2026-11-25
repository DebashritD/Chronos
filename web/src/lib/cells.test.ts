import { describe, expect, it } from 'vitest'
import { isColor, markKind } from './cells'

describe('cells', () => {
  it('knows which states are marked colors', () => {
    expect(isColor('YELLOW')).toBe(true)
    expect(isColor('PENDING')).toBe(false)
    expect(isColor('GREY')).toBe(false)
  })
})

describe('markKind', () => {
  it('shows colours as themselves and unmarked periods as open or future rings', () => {
    expect(markKind('GREEN', false)).toBe('GREEN')
    expect(markKind('RED', true)).toBe('RED')
    expect(markKind('PENDING', false)).toBe('OPEN')
    expect(markKind('PENDING', true)).toBe('FUTURE')
    expect(markKind('GREY', false)).toBe('OPEN')
    expect(markKind('PAUSED', false)).toBe('PAUSED')
    expect(markKind('NOT_DUE', false)).toBeNull()
  })
})
