import { describe, expect, it } from 'vitest'
import type { CellState } from '../../api/types'
import type { TodayItem } from './todayItems'
import { todaySummary } from './todaySummary'

const NOW = new Date('2026-11-18T06:30:00Z') // 12h before the 18:30Z close
const LATE = new Date('2026-11-18T16:00:00Z') // 2h30m left
const CLOSE = '2026-11-18T18:30:00Z'
const NAMES = ['Run', 'Read', 'Meditate', 'Stretch', 'Walk']

function item(id: number, state: CellState, closesAt = CLOSE): TodayItem {
  return {
    habit: { id, name: NAMES[id - 1], minText: '', targetText: '', frequency: 'DAILY', intervalDays: null, status: 'ACTIVE',
      current: null, cells: [] },
    cell: { date: '2026-11-18', periodStart: '2026-11-18', state, editable: true, note: null, closesAt },
  }
}
const day = (...states: CellState[]) => states.map((s, i) => item(i + 1, s))
const none = () => undefined
const at = (iso: string) => new Date(iso)

describe('todaySummary', () => {
  it('has nothing due', () => {
    expect(todaySummary([], NOW, none)).toMatchObject({ headline: 'Nothing due today', line: 'Enjoy the break.', countdown: null })
  })

  it('starts the day', () => {
    const s = todaySummary(day('PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING'), NOW, none)
    expect(s).toMatchObject({ headline: 'Let’s start', line: '5 habits today. The minimum counts.', tone: 'default',
      countdown: { text: '12h left', urgent: false }, label: '0 of 5 marked' })
    expect(todaySummary(day('PENDING'), NOW, none).line).toBe('1 habit today. The minimum counts.')
  })

  it('is a good start up to half', () => {
    const s = todaySummary(day('GREEN', 'YELLOW', 'PENDING', 'PENDING', 'PENDING'), NOW, none)
    expect(s).toMatchObject({ headline: 'Good start', line: '2 of 5 marked. 3 to go.', label: '2 of 5 marked: 1 target, 1 minimum',
      segments: ['GREEN', 'YELLOW', 'PENDING', 'PENDING', 'PENDING'] })
  })

  it('says go green when most are marked on target', () => {
    expect(todaySummary(day('GREEN', 'GREEN', 'GREEN', 'PENDING', 'PENDING'), NOW, none))
      .toMatchObject({ headline: 'Aim for target', line: 'Almost there. 3 of 5 on target.', tone: 'green' })
  })

  it('says almost there when most are marked with a minimum', () => {
    expect(todaySummary(day('GREEN', 'YELLOW', 'GREEN', 'PENDING', 'PENDING'), NOW, none))
      .toMatchObject({ headline: 'Almost there', line: '3 of 5 marked. 2 to go.', tone: 'default' })
  })

  it('names the last one, even after a miss', () => {
    expect(todaySummary(day('GREEN', 'GREEN', 'YELLOW', 'GREEN', 'PENDING'), NOW, none))
      .toMatchObject({ headline: 'Walk is the last one', line: 'Mark it to close the day.' })
    expect(todaySummary(day('RED', 'GREEN', 'GREEN', 'GREEN', 'PENDING'), NOW, none).headline).toBe('Walk is the last one')
  })

  it('stays kind after a miss', () => {
    expect(todaySummary(day('RED', 'PENDING', 'PENDING', 'PENDING', 'PENDING'), NOW, none))
      .toMatchObject({ headline: 'Still in it', line: '1 missed. The other 4 can stay off red.' })
  })

  it('counts down when late, naming only the habits closing soon', () => {
    const s = todaySummary(day('GREEN', 'GREEN', 'YELLOW', 'PENDING', 'PENDING'), LATE, none)
    expect(s).toMatchObject({ headline: '2 hours left', line: 'Stretch and Walk are still open.', countdown: { text: '2h left', urgent: true } })
    expect(todaySummary(day('GREEN', 'GREEN', 'YELLOW', 'GREEN', 'PENDING'), LATE, none).line).toBe('Walk is still open.')
    expect(todaySummary(day('GREEN', 'GREEN', 'PENDING', 'PENDING', 'PENDING'), LATE, none).line).toBe('3 habits are still open.')
    const weekly = [...day('GREEN', 'GREEN', 'YELLOW'), item(4, 'PENDING', '2026-11-22T18:30:00Z'), item(5, 'PENDING')]
    expect(todaySummary(weekly, LATE, none).line).toBe('Walk is still open.')
    expect(todaySummary(day('GREEN', 'PENDING'), at('2026-11-18T17:00:00Z'), none).headline).toBe('1 hour left')
    const s30 = todaySummary(day('GREEN', 'PENDING'), at('2026-11-18T18:00:00Z'), none)
    expect(s30).toMatchObject({ headline: '30 minutes left', countdown: { text: '30m left', urgent: true } })
  })

  it('guards the longest streak at risk when late', () => {
    const streaks: Record<number, number> = { 4: 12, 5: 8 }
    expect(todaySummary(day('GREEN', 'GREEN', 'YELLOW', 'PENDING', 'PENDING'), LATE, (id) => streaks[id]))
      .toMatchObject({ headline: 'Keep the 12-day streak', line: 'Stretch is still open.' })
    expect(todaySummary(day('GREEN', 'GREEN', 'YELLOW', 'PENDING', 'PENDING'), LATE, () => 6).headline).toBe('2 hours left')
  })

  it('says there is still time when late and nothing is marked', () => {
    expect(todaySummary(day('PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING'), LATE, none))
      .toMatchObject({ headline: 'There’s still time', line: 'A minimum on each keeps all 5 off red.' })
    expect(todaySummary(day('PENDING'), LATE, none).line).toBe('A minimum keeps it off red.')
  })

  it('closes the day three ways', () => {
    expect(todaySummary(day('GREEN', 'GREEN', 'GREEN', 'GREEN', 'GREEN'), NOW, none))
      .toMatchObject({ headline: 'All on target', line: '5 of 5 on target today.', tone: 'green', countdown: null })
    expect(todaySummary(day('GREEN', 'YELLOW', 'GREEN', 'YELLOW', 'GREEN'), NOW, none))
      .toMatchObject({ headline: 'All done', line: '3 on target, 2 at minimum. All off red.', tone: 'default' })
    expect(todaySummary(day('GREEN', 'GREEN', 'RED', 'GREEN', 'YELLOW'), NOW, none)).toMatchObject({ headline: 'All marked',
      line: '4 off red, 1 missed. Tomorrow resets.', label: '5 of 5 marked: 3 target, 1 minimum, 1 missed', countdown: null })
  })
})
