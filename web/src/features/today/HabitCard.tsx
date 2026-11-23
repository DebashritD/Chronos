import { Clock, Flame, NotebookPen } from 'lucide-react'
import { useId, useState } from 'react'
import { messageFor } from '../../api/errors'
import type { Color, WeekCell, WeekHabit } from '../../api/types'
import { cellClass, isColor } from '../../lib/cells'
import { hapticMark } from '../../lib/haptics'
import { formatTimeLeft, isUrgent } from '../../lib/timeLeft'
import { card, pillButton } from '../../lib/ui'
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

function meta(habit: WeekHabit): string {
  const texts = `Min ${habit.minText} · Target ${habit.targetText}`
  if (habit.frequency === 'EVERY_N_DAYS') return `Every ${habit.intervalDays} days · ${texts}`
  if (habit.frequency === 'WEEKLY') return `This week · ${texts}`
  return texts
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

/** One habit on Today: tap Target / Minimum / Missed to save at once (keeping any note); tap the name for the picker. */
export function HabitCard({ habit, cell, streak, now, yellowLimit, onOpen }: HabitCardProps) {
  const saveCheckIn = useSaveCheckIn()
  const titleId = useId()
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [popped, setPopped] = useState<Color | null>(null)
  const [missedJustNow, setMissedJustNow] = useState(false)
  const marked = isColor(cell.state)
  // At the limit, one more yellow restarts the streak (re-tapping today's own yellow changes nothing).
  const yellowResets = yellowLimit !== undefined && cell.state !== 'YELLOW'
  const timeLeft = cell.closesAt ? formatTimeLeft(cell.closesAt, now, habit.frequency) : null
  const tone: Tone = marked ? 'done' : cell.closesAt && isUrgent(cell.closesAt, now) ? 'urgent' : 'normal'

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

  async function saveNote(color: Color, text: string): Promise<void> {
    setError(null)
    try {
      await saveCheckIn.mutateAsync({ habitId: habit.id, periodStart: cell.periodStart ?? cell.date, color, note: text.trim() || null })
      setDraft(null)
    } catch (err) {
      setError(messageFor(err))
    }
  }

  return (
    <article aria-labelledby={titleId} className={card}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-[18px] font-bold break-words text-fg">
            <button type="button" aria-haspopup="dialog" onClick={onOpen} className="text-left hover:underline">
              {habit.name}
            </button>
          </h2>
          <p className="mt-0.5 text-[13px] break-words text-muted">{meta(habit)}</p>
        </div>
        {streak !== undefined && (
          <span className="flex flex-none items-center gap-1 font-display text-[15px] font-bold text-fg">
            <Flame size={18} className={streak > 0 ? 'text-urgent' : 'text-dim'} aria-hidden="true" />
            <span className="sr-only">Current streak </span>
            {streak}
          </span>
        )}
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
            <span data-tone={tone}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${TONE_CLASS[tone]}`}>
              <Clock size={13} aria-hidden="true" />
              {timeLeft}
            </span>
          )}
          {yellowLimit !== undefined && (
            <span className="rounded-full bg-cell-yellow/15 px-2.5 py-1 text-[12px] font-semibold text-cell-yellow">
              {yellowLimit}/{yellowLimit} yellows
            </span>
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
      {marked && draft === null && (
        <button type="button" onClick={() => setDraft(cell.note ?? '')}
          aria-label={`${cell.note ? 'Edit' : 'Add'} note for ${habit.name}`}
          className="mt-3 flex w-full items-start gap-2 rounded-[14px] bg-surface px-3 py-2.5 text-left text-[14px]">
          <NotebookPen size={16} className="mt-0.5 flex-none text-muted" aria-hidden="true" />
          {cell.note
            ? <span className="min-w-0 break-words whitespace-pre-wrap text-fg">{cell.note}</span>
            : <span className="text-muted">Add a note</span>}
        </button>
      )}
      {marked && draft !== null && (
        <form className="mt-3" onSubmit={(e) => { e.preventDefault(); void saveNote(cell.state as Color, draft) }}>
          <label htmlFor={`${titleId}-note`} className="sr-only">Note for {habit.name}</label>
          <textarea id={`${titleId}-note`} rows={2} maxLength={500} autoFocus value={draft}
            onChange={(e) => setDraft(e.target.value)} placeholder="How did it go?"
            className="w-full rounded-[14px] border border-line bg-surface px-3 py-2.5 text-[14px] text-fg placeholder:text-dim focus:border-accent focus:outline-none" />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setDraft(null)}
              className={pillButton}>Cancel</button>
            <button type="submit" disabled={saveCheckIn.isPending}
              className="rounded-full bg-accent px-3 py-1.5 text-[13px] font-semibold text-bg disabled:opacity-50">Save note</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-cell-red">{error}</p>}
    </article>
  )
}

export default HabitCard
