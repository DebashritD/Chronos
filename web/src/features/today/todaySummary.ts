import type { CellState } from '../../api/types'
import { isColor } from '../../lib/cells'
import { isUrgent } from '../../lib/timeLeft'
import type { TodayItem } from './todayItems'

export interface Summary {
  headline: string
  line: string
  tone: 'default' | 'green'
  countdown: { text: string; urgent: boolean } | null
  segments: CellState[]
  label: string
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const STREAK_AT_RISK = 7

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`

function shortLeft(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.floor(ms / MINUTE))}m left`
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h left`
  return `${Math.floor(ms / DAY)}d left`
}

function longLeft(ms: number): string {
  return ms < HOUR ? `${plural(Math.max(1, Math.floor(ms / MINUTE)), 'minute')} left` : `${plural(Math.floor(ms / HOUR), 'hour')} left`
}

function stillOpen(items: TodayItem[]): string {
  if (items.length === 1) return `${items[0].habit.name} is still open.`
  if (items.length === 2) return `${items[0].habit.name} and ${items[1].habit.name} are still open.`
  return `${items.length} habits are still open.`
}

/** The Today headline, line, countdown and segments for the day's progress. First matching state wins (see spec). */
export function todaySummary(items: TodayItem[], now: Date, streakOf: (habitId: number) => number | undefined): Summary {
  const total = items.length
  const count = (state: CellState) => items.filter(({ cell }) => cell.state === state).length
  const green = count('GREEN')
  const yellow = count('YELLOW')
  const red = count('RED')
  const marked = green + yellow + red
  const open = items.filter(({ cell }) => !isColor(cell.state))
  const urgentOpen = open.filter(({ cell }) => cell.closesAt !== null && isUrgent(cell.closesAt, now))
  const closes = open.map(({ cell }) => (cell.closesAt ? Date.parse(cell.closesAt) : NaN))
    .filter((t) => !Number.isNaN(t) && t > now.getTime())
  const msLeft = closes.length > 0 ? Math.min(...closes) - now.getTime() : null

  const parts = [[green, 'target'], [yellow, 'minimum'], [red, 'missed']]
    .filter(([n]) => (n as number) > 0).map(([n, word]) => `${n} ${word}`)
  const base = {
    segments: items.map(({ cell }) => cell.state),
    label: `${marked} of ${total} marked${parts.length > 0 ? `: ${parts.join(', ')}` : ''}`,
    countdown: msLeft === null ? null : { text: shortLeft(msLeft), urgent: urgentOpen.length > 0 },
  }
  const say = (headline: string, line: string, tone: Summary['tone'] = 'default'): Summary => ({ ...base, headline, line, tone })

  if (total === 0) return say('Nothing due today', 'Enjoy the break.')
  if (open.length === 0) {
    if (red > 0) return say('All marked', `${total - red} off red, ${red} missed. Tomorrow resets.`)
    if (yellow === 0) return say('All on target', `${total} of ${total} on target today.`, 'green')
    return say('All done', `${green} on target, ${yellow} at minimum. All off red.`)
  }
  if (urgentOpen.length > 0 && msLeft !== null) {
    const atRisk = urgentOpen
      .map((item) => ({ item, streak: streakOf(item.habit.id) ?? 0 }))
      .filter(({ streak }) => streak >= STREAK_AT_RISK)
      .reduce<{ item: TodayItem; streak: number } | null>((best, next) => (best && best.streak >= next.streak ? best : next), null)
    if (atRisk) return say(`Keep the ${atRisk.streak}-day streak`, `${atRisk.item.habit.name} is still open.`)
    if (marked === 0) {
      return say('There’s still time', total === 1 ? 'A minimum keeps it off red.' : `A minimum on each keeps all ${total} off red.`)
    }
    return say(longLeft(msLeft), stillOpen(urgentOpen))
  }
  if (open.length === 1 && marked > 0) return say(`${open[0].habit.name} is the last one`, 'Mark it to close the day.')
  if (red > 0) return say('Still in it', `${red} missed. The other ${open.length} can stay off red.`)
  if (marked === 0) return say('Let’s start', `${plural(total, 'habit')} today. The minimum counts.`)
  const progress = `${marked} of ${total} marked. ${open.length} to go.`
  if (marked > total / 2) {
    return yellow === 0 && red === 0
      ? say('Aim for target', `Almost there. ${marked} of ${total} on target.`, 'green')
      : say('Almost there', progress)
  }
  return say('Good start', progress)
}
