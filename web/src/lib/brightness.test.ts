import { describe, expect, it } from 'vitest'
import { brightness } from './brightness'

describe('brightness', () => {
  it('keeps every mark bright when nothing was missed', () => {
    expect(brightness(['GREEN', 'YELLOW', 'PENDING'])).toEqual([true, true, true])
  })
  it('dims marks before the last miss and keeps every miss bright', () => {
    expect(brightness(['GREEN', 'RED', 'GREEN', 'YELLOW'])).toEqual([false, true, true, true])
    expect(brightness(['GREEN', 'RED', 'GREEN', 'RED', 'GREEN'])).toEqual([false, true, false, true, true])
  })
})
