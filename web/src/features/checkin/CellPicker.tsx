import { useRef, useState } from 'react'
import { messageFor } from '../../api/errors'
import type { Color, WeekCell, WeekHabit } from '../../api/types'
import { cellClass, isColor, STATE_LABEL } from '../../lib/cells'
import { hapticMark } from '../../lib/haptics'
import { inputClass, primaryButton } from '../../lib/ui'
import { MOBILE_QUERY, REDUCED_MOTION_QUERY, useMediaQuery } from '../../lib/useMediaQuery'
import { useClearCheckIn, useSaveCheckIn } from '../stats/api'
import { StreakBadge, TimeLeftChip, WeekPills } from '../today/habitBits'
import { periodLabel } from './period'
import { useSheetDrag } from './useSheetDrag'

/** Each choice is tinted in its own colour once it is the saved one. */
const CHOICES: { color: Color; hint(habit: WeekHabit): string; selected: string }[] = [
  { color: 'GREEN', hint: (habit) => habit.targetText, selected: 'border-cell-green bg-cell-green/15' },
  { color: 'YELLOW', hint: (habit) => habit.minText, selected: 'border-cell-yellow bg-cell-yellow/15' },
  { color: 'RED', hint: () => "Didn't do it", selected: 'border-cell-red bg-cell-red/15' },
]

interface CellPickerProps {
  habit: WeekHabit
  cell: WeekCell
  /** Current streak, once the streaks query has loaded. */
  streak?: number
  now: Date
  onClose(): void
}

/**
 * Bottom sheet on phones, centred dialog on wider screens. Tapping a choice saves it (with any note) and closes;
 * "Save note" saves a changed note on an already-marked period; Clear removes the check-in.
 */
export function CellPicker({ habit, cell, streak, now, onClose }: CellPickerProps) {
  const saveCheckIn = useSaveCheckIn()
  const clearCheckIn = useClearCheckIn()
  const saved = isColor(cell.state) ? cell.state : null
  const [note, setNote] = useState(cell.note ?? '')
  const [noteOpen, setNoteOpen] = useState(Boolean(cell.note))
  const [error, setError] = useState<string | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const mobile = useMediaQuery(MOBILE_QUERY)
  const reduced = useMediaQuery(REDUCED_MOTION_QUERY)
  useSheetDrag(sheetRef, { enabled: mobile, reduced, onClose })
  const busy = saveCheckIn.isPending || clearCheckIn.isPending
  const key = { habitId: habit.id, periodStart: cell.periodStart ?? cell.date }
  const noteChanged = note.trim() !== (cell.note ?? '')

  async function run(action: () => Promise<unknown>): Promise<void> {
    setError(null)
    try {
      await action()
      onClose()
    } catch (err) {
      setError(messageFor(err))
    }
  }

  function save(color: Color): void {
    hapticMark(color)
    void run(() => saveCheckIn.mutateAsync({ ...key, color, note: note.trim() || null }))
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}>
      <div ref={sheetRef} role="dialog" aria-modal="true" aria-label={`${habit.name}, ${periodLabel(habit, cell)}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
        className="w-full rounded-t-[28px] border border-line bg-card px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:max-w-md md:rounded-[28px] md:pt-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline md:hidden" aria-hidden="true" />
        <h2 className="text-[22px] font-semibold text-fg">{habit.name}</h2>
        <p className="mt-0.5 text-[14px] text-muted">{periodLabel(habit, cell)}</p>
        <div className="mt-3 mb-4 flex min-h-6 items-center gap-2">
          {streak !== undefined && <StreakBadge streak={streak} />}
          <TimeLeftChip habit={habit} cell={cell} now={now} />
          {habit.frequency === 'DAILY' && <WeekPills cells={habit.cells} ring={cell.date} className="ml-auto" />}
        </div>
        <div className="flex flex-col gap-2">
          {CHOICES.map((choice) => (
            <button key={choice.color} type="button" aria-pressed={saved === choice.color} disabled={busy}
              onClick={() => save(choice.color)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left disabled:opacity-60 ${
                saved === choice.color ? choice.selected : 'border-line bg-surface'
              }`}>
              <span className={`h-6 w-6 flex-none rounded-lg ${cellClass(choice.color)}`} aria-hidden="true" />
              <span className="text-[15px] font-semibold text-fg">
                {STATE_LABEL[choice.color]}
                <small className="block text-[13px] font-normal text-muted">{choice.hint(habit)}</small>
              </span>
            </button>
          ))}
        </div>
        {noteOpen ? (
          <>
            <label htmlFor="check-in-note" className="mt-4 mb-1.5 block text-[13px] font-medium text-muted">
              Note (optional)
            </label>
            {/* Focus only when opened by "+ Add note"; an existing note shouldn't pop the keyboard. */}
            <textarea id="check-in-note" rows={2} maxLength={500} value={note} autoFocus={!cell.note}
              onChange={(e) => setNote(e.target.value)} className={inputClass} />
          </>
        ) : (
          <button type="button" onClick={() => setNoteOpen(true)}
            className="mt-4 text-[14px] font-semibold text-accent">+ Add note</button>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-cell-red">{error}</p>}
        {saved && (
          <div className="mt-5 flex items-center gap-2">
            <button type="button" disabled={busy}
              className="rounded-[14px] border border-line bg-surface px-4 py-3 text-[15px] font-medium text-cell-red disabled:opacity-50"
              onClick={() => void run(() => clearCheckIn.mutateAsync(key))}>Clear</button>
            {noteChanged && (
              <button type="button" disabled={busy} className={`${primaryButton} ml-auto`}
                onClick={() => void run(() => saveCheckIn.mutateAsync({ ...key, color: saved, note: note.trim() || null }))}>
                Save note
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CellPicker
