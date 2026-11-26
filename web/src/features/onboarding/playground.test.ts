import { describe, expect, it } from 'vitest'
import type { Color } from '../../api/types'
import { playgroundStreak } from './playground'

const G: Color = 'GREEN'
const Y: Color = 'YELLOW'
const R: Color = 'RED'

describe('playgroundStreak', () => {
  it('counts Minimums within the limit', () => {
    expect(playgroundStreak([G, Y, G, G, Y, Y, G], 2)).toEqual({
      now: 7, best: 7, restart: null, reason: 'Every Minimum counted: never more than 2 in a row.',
    })
  })

  it('starts a new streak at 1 on the Minimum one past the limit', () => {
    const result = playgroundStreak([G, Y, Y, Y, G, G, G], 2)
    expect(result).toMatchObject({ now: 4, best: 4, restart: 'minimums' })
    expect(result.reason).toBe('Thu was Minimum number 3 in a row, one more than allowed, so a new streak started there.')
  })

  it('keeps counting the Minimum run across a restart, like the server', () => {
    expect(playgroundStreak([Y, Y, Y, Y, Y, G, G], 2)).toMatchObject({ now: 3, best: 3 })
  })

  it('restarts on a miss', () => {
    expect(playgroundStreak([G, G, R, G, G, G, G], 2)).toMatchObject({
      now: 4, best: 4, restart: 'miss', reason: 'The miss on Wed restarted the streak.',
    })
  })

  it('praises a week on target', () => {
    expect(playgroundStreak(Array<Color>(7).fill(G), 2).reason).toBe('Seven days on target.')
  })
})
