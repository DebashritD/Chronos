import { describe, expect, it } from 'vitest'
import { brightness } from './brightness'

describe('brightness', () => {
  it('keeps every mark bright when nothing was missed', () => {
    expect(brightness(['GREEN', 'YELLOW', 'PENDING'])).toEqual([true, true, true])
  })
  it('dims marks before the last miss and keeps the miss itself bright', () => {
    expect(brightness(['GREEN', 'RED', 'GREEN', 'YELLOW'])).toEqual([false, true, true, true])
    expect(brightness(['GREEN', 'RED', 'GREEN', 'RED', 'GREEN'])).toEqual([false, false, false, true, true])
  })
})
