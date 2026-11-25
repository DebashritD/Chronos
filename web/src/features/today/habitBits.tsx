import { Clock, Flame } from 'lucide-react'
import type { WeekCell, WeekHabit } from '../../api/types'
import { cellClass, isColor } from '../../lib/cells'
import { formatTimeLeft, isUrgent } from '../../lib/timeLeft'
import { chip } from '../../lib/ui'

type Tone = 'normal' | 'urgent' | 'done'

const TONE_CLASS: Record<Tone, string> = {
  normal: 'bg-surface text-muted',
  urgent: 'bg-urgent/15 text-urgent',
  done: 'bg-cell-green/15 text-cell-green',
}

export function StreakBadge({ streak }: { streak: number }) {
  return (
    <span className="flex flex-none items-center gap-1 font-display text-[15px] font-semibold text-fg">
      <Flame size={18} className={streak > 0 ? 'text-urgent' : 'text-dim'} aria-hidden="true" />
      <span className="sr-only">Current streak </span>
      {streak}
    </span>
  )
}

/** Countdown to the end of the cell's period; nothing once it has closed. */
export function TimeLeftChip({ habit, cell, now }: { habit: WeekHabit; cell: WeekCell; now: Date }) {
  const text = cell.closesAt ? formatTimeLeft(cell.closesAt, now, habit.frequency) : null
  if (!text) return null
  const tone: Tone = isColor(cell.state) ? 'done' : cell.closesAt && isUrgent(cell.closesAt, now) ? 'urgent' : 'normal'
  return (
    <span data-tone={tone} className={`${chip} ${TONE_CLASS[tone]}`}>
      <Clock size={13} aria-hidden="true" />
      {text}
    </span>
  )
}

/** The week's days as short pills; `ring` (a date) rings one of them. */
export function WeekPills({ cells, ring, className = '' }: { cells: WeekCell[]; ring?: string; className?: string }) {
  return (
    <span className={`flex gap-1 ${className}`} aria-hidden="true">
      {cells.map((c) => (
        <span key={c.date} data-ring={c.date === ring ? '' : undefined} className={`h-1.5 w-4 rounded-full ${
          c.state === 'PENDING' || c.state === 'NOT_DUE' ? 'bg-surface' : cellClass(c.state)
        }${c.date === ring ? ' ring-2 ring-fg ring-offset-1 ring-offset-card' : ''}`} />
      ))}
    </span>
  )
}
