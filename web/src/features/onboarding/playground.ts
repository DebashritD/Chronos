import type { Color } from '../../api/types'

export const PLAYGROUND_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export interface PlaygroundStreak {
  now: number
  best: number
  /** Why the streak stands where it does, in plain words. */
  reason: string
  /** What restarted it last, if anything. */
  restart: 'miss' | 'minimums' | null
}

/**
 * The server's streak rule over one sample week: a miss resets it to 0; one Minimum more than `limit` in a row starts
 * a new streak at 1 (that day counts).
 */
export function playgroundStreak(marks: Color[], limit: number): PlaygroundStreak {
  let now = 0
  let best = 0
  let minimums = 0
  let restart: PlaygroundStreak['restart'] = null
  let reason: string | null = null
  marks.forEach((mark, i) => {
    const day = PLAYGROUND_DAYS[i]
    if (mark === 'RED') {
      now = 0
      minimums = 0
      restart = 'miss'
      reason = `The miss on ${day} restarted the streak.`
    } else if (mark === 'YELLOW' && ++minimums > limit) {
      now = 1
      minimums = 1
      restart = 'minimums'
      reason = `${day} was Minimum number ${limit + 1} in a row, one more than allowed, so a new streak started there.`
    } else {
      if (mark === 'GREEN') minimums = 0
      now++
    }
    best = Math.max(best, now)
  })
  reason ??= marks.includes('YELLOW') ? `Every Minimum counted: never more than ${limit} in a row.` : 'Seven days on target.'
  return { now, best, reason, restart }
}
