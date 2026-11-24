import { Clock, Flame, NotebookPen } from 'lucide-react'
import { useId, useState } from 'react'
import { messageFor } from '../../api/errors'
import type { Color, WeekCell, WeekHabit } from '../../api/types'
import { cellClass, isColor, STATE_LABEL } from '../../lib/cells'
import { hapticMark } from '../../lib/haptics'
import { formatTimeLeft, isUrgent } from '../../lib/timeLeft'
import { card } from '../../lib/ui'
import { useSaveCheckIn } from '../stats/api'

/** Each choice wears its colour before it's pressed (dot + tinted edge) and fills with it once selected. */
const BUTTONS: { color: Color; label: string; idle: string; dot: string; selected: string }[] = [
  { color: 'GREEN', label: 'Target', idle: 'border-cell-green/30 bg-cell-green/[0.07]', dot: 'bg-cell-green',
    selected: 'border-cell-green bg-cell-green text-bg' },
  { color: 'YELLOW', label: 'Minimum', idle: 'border-cell-yellow/30 bg-cell-yellow/[0.07]', dot: 'bg-cell-yellow',
    selected: 'border-cell-yellow bg-cell-yellow text-bg' },
  { color: 'RED', label: 'Missed', idle: 'border-cell-red/30 bg-cell-red/[0.07]', dot: 'bg-cell-red',
    selected: 'border-cell-red bg-cell-red text-bg' },
]

type Tone = 'normal' | 'urgent' | 'done'

const TONE_CLASS: Record<Tone, string> = {
  normal: 'bg-surface text-muted',
  urgent: 'bg-urgent/15 text-urgent',
  done: 'bg-cell-green/15 text-cell-green',
}

const chipBase = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold'

function frequencyChip(habit: WeekHabit): string | null {
  if (habit.frequency === 'EVERY_N_DAYS') return `Every ${habit.intervalDays} days`
  if (habit.frequency === 'WEEKLY') return 'This week'
  return null
}

function NotePreview({ note, className = '' }: { note: string; className?: string }) {
  return (
    <p className={`flex items-center gap-1 text-[12px] text-muted ${className}`}>
      <NotebookPen size={12} className="flex-none" aria-hidden="true" />
      <span className="truncate">{note}</span>
    </p>
  )
}

interface HabitCardProps {
  habit: WeekHabit
  cell: WeekCell
  /** Current streak, once the streaks query has loaded. */
  streak: number | undefined
  now: Date
  /** N while this habit is at its yellow limit. */
  yellowLimit?: number
  onOpen(): void
}

/**
 * One habit on Today. Until it's green: a card with one-tap Target / Minimum / Missed. Green: a one-line row that
 * opens the picker. Both share the <article> root so the node (and this state) survives the switch.
 */
export function HabitCard({ habit, cell, streak, now, yellowLimit, onOpen }: HabitCardProps) {
  const saveCheckIn = useSaveCheckIn()
  const titleId = useId()
  const [error, setError] = useState<string | null>(null)
  const [popped, setPopped] = useState<Color | null>(null)
  const [missedJustNow, setMissedJustNow] = useState(false)
  const marked = isColor(cell.state)
  // At the limit, one more yellow restarts the streak (re-tapping today's own yellow changes nothing).
  const yellowResets = yellowLimit !== undefined && cell.state !== 'YELLOW'
  const timeLeft = cell.closesAt ? formatTimeLeft(cell.closesAt, now, habit.frequency) : null
  const tone: Tone = marked ? 'done' : cell.closesAt && isUrgent(cell.closesAt, now) ? 'urgent' : 'normal'
  const freq = frequencyChip(habit)

  async function mark(color: Color): Promise<void> {
    if (cell.state === color) return
    setError(null)
    hapticMark(color)
    try {
      await saveCheckIn.mutateAsync({ habitId: habit.id, periodStart: cell.periodStart ?? cell.date, color, note: cell.note })
      // A miss gets a quiet word instead of the celebratory pop.
      setPopped(color === 'RED' ? null : color)
      setMissedJustNow(color === 'RED')
    } catch (err) {
      setError(messageFor(err))
    }
  }

  const streakBadge = streak !== undefined && (
    <span className="flex flex-none items-center gap-1 font-display text-[15px] font-semibold text-fg">
      <Flame size={18} className={streak > 0 ? 'text-urgent' : 'text-dim'} aria-hidden="true" />
      <span className="sr-only">Current streak </span>
      {streak}
    </span>
  )
  const errorLine = error && <p role="alert" className="mt-2 text-sm text-cell-red">{error}</p>

  if (cell.state === 'GREEN') {
    return (
      <article aria-labelledby={titleId}
        className="relative flex items-center gap-3 rounded-[18px] border border-line bg-card px-4 py-3">
        <span aria-hidden="true" data-pop={popped === 'GREEN' ? '' : undefined} onAnimationEnd={() => setPopped(null)}
          className={`h-[22px] w-[22px] flex-none rounded-[7px] data-pop:animate-pop ${cellClass(cell.state)}`} />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-[15px] font-semibold break-words text-fg">
            {/* The ::after stretches the tap target over the whole row. */}
            <button type="button" aria-haspopup="dialog" onClick={onOpen}
              className="text-left after:absolute after:inset-0 after:rounded-[18px]">
              {habit.name}
            </button>
          </h2>
          <p className="sr-only">{STATE_LABEL[cell.state]}</p>
          {cell.note && <NotePreview note={cell.note} />}
          {errorLine}
        </div>
        {streakBadge}
      </article>
    )
  }

  return (
    <article aria-labelledby={titleId} className={card}>
      <div className="flex items-start justify-between gap-3">
        <h2 id={titleId} className="min-w-0 text-[18px] font-semibold break-words text-fg">
          <button type="button" aria-haspopup="dialog" onClick={onOpen} className="text-left hover:underline">
            {habit.name}
          </button>
        </h2>
        {streakBadge}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {BUTTONS.map(({ color, label, idle, dot, selected }) => {
          const pressed = cell.state === color
          const warn = color === 'YELLOW' && yellowResets
          return (
            <button key={color} type="button" aria-pressed={pressed} disabled={saveCheckIn.isPending}
              aria-describedby={warn ? `${titleId}-reset` : undefined}
              onClick={() => void mark(color)}
              onAnimationEnd={() => setPopped(null)}
              data-pop={popped === color ? '' : undefined}
              className={`flex min-h-12 flex-col items-center justify-center rounded-[14px] border px-1 py-2 text-[14px] font-semibold transition-[transform,background-color,border-color] active:scale-[0.97] disabled:opacity-60 data-pop:animate-pop ${
                pressed ? selected : `${idle} text-fg`
              }`}>
              <span className="flex items-center gap-1.5">
                {!pressed && <span className={`h-2 w-2 flex-none rounded-full ${dot}`} aria-hidden="true" />}
                {label}
              </span>
              {warn && <span className="text-[11px] leading-tight font-medium text-cell-yellow" aria-hidden="true">restarts streak</span>}
            </button>
          )
        })}
      </div>
      {yellowResets && (
        <p id={`${titleId}-reset`} className="sr-only">You've used {yellowLimit} yellows in a row; another restarts the streak.</p>
      )}
      {missedJustNow && cell.state === 'RED' && (
        <p role="status" className="mt-3 text-[14px] text-muted">
          That's honest. {habit.frequency === 'DAILY' ? 'Tomorrow' : 'The next one'} is a fresh start.
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-1.5">
          {timeLeft && (
            <span data-tone={tone} className={`${chipBase} ${TONE_CLASS[tone]}`}>
              <Clock size={13} aria-hidden="true" />
              {timeLeft}
            </span>
          )}
          {freq && <span className={`${chipBase} bg-surface text-muted`}>{freq}</span>}
          {yellowLimit !== undefined && (
            <span className={`${chipBase} bg-cell-yellow/15 text-cell-yellow`}>{yellowLimit}/{yellowLimit} yellows</span>
          )}
        </span>
        {habit.frequency === 'DAILY' && (
          <span className="flex gap-1 md:hidden" aria-hidden="true">
            {habit.cells.map((c) => (
              <span key={c.date} className={`h-1.5 w-4 rounded-full ${
                c.state === 'PENDING' || c.state === 'NOT_DUE' ? 'bg-surface' : cellClass(c.state)
              }`} />
            ))}
          </span>
        )}
      </div>
      {marked && cell.note && <NotePreview note={cell.note} className="mt-3" />}
      {errorLine}
    </article>
  )
}

export default HabitCard
