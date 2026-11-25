import { useEffect, useId, useRef, useState } from 'react'
import { messageFor } from '../../api/errors'
import type { Color, WeekCell, WeekHabit } from '../../api/types'
import { Mark } from '../../app/Mark'
import { isColor, STATE_LABEL } from '../../lib/cells'
import { hapticMark } from '../../lib/haptics'
import { inkButton, textButton, underlineInput } from '../../lib/ui'
import { MOBILE_QUERY, REDUCED_MOTION_QUERY, useMediaQuery } from '../../lib/useMediaQuery'
import { useClearCheckIn, useSaveCheckIn } from '../stats/api'
import { StreakLine } from '../today/habitBits'
import { periodLabel } from './period'
import { useSheetDrag } from './useSheetDrag'

const CHOICES: { color: Color; hint(habit: WeekHabit): string }[] = [
  { color: 'GREEN', hint: (habit) => habit.targetText },
  { color: 'YELLOW', hint: (habit) => habit.minText },
  { color: 'RED', hint: () => "Didn't do it" },
]

interface CellPickerProps {
  habit: WeekHabit
  cell: WeekCell
  /** Current streak, once the streaks query has loaded. */
  streak?: number
  /** Set while the habit has used every yellow it may have in a row; another restarts the streak. */
  yellowLimit?: number
  now: Date
  onClose(): void
}

/**
 * Bottom sheet on phones, centred dialog on wider screens. Tapping a choice saves it (with any note) and closes;
 * "Save note" saves a changed note on an already-marked period; Clear removes the check-in.
 */
export function CellPicker({ habit, cell, streak, yellowLimit, now, onClose }: CellPickerProps) {
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
  const resetId = useId()
  const yellowResets = yellowLimit !== undefined && cell.state !== 'YELLOW'

  // Take focus so Esc reaches the dialog; not a choice, where a stray Enter would save. Hand it back on close.
  useEffect(() => {
    const opener = document.activeElement
    sheetRef.current?.focus({ preventScroll: true })
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])
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
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-binding/45 md:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}>
      <div ref={sheetRef} role="dialog" aria-modal="true" tabIndex={-1} aria-label={`${habit.name}, ${periodLabel(habit, cell)}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
        className="perforated w-full bg-paper px-6 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] outline-none md:max-w-md md:rounded-[12px] md:pt-7">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-rule-2 md:hidden" aria-hidden="true" />
        <h2 className="font-display text-[26px] leading-tight text-ink">{habit.name}</h2>
        <p className="font-mono text-[12px] text-muted">{periodLabel(habit, cell)}</p>
        <StreakLine habit={habit} cell={cell} streak={streak} now={now} />
        <div className="border-t border-rule">
          {CHOICES.map((choice) => {
            const warn = yellowResets && choice.color === 'YELLOW'
            return (
              <button key={choice.color} type="button" aria-pressed={saved === choice.color} disabled={busy}
                aria-describedby={warn ? resetId : undefined} onClick={() => save(choice.color)}
                className={`flex min-h-14 w-full items-center gap-3 border-b border-rule px-1 py-3 text-left disabled:opacity-60 ${saved === choice.color ? 'bg-paper-2' : ''}`}>
                <Mark kind={choice.color} size={18} />
                <span className="min-w-0 flex-1 text-[16px] font-semibold text-ink">
                  {STATE_LABEL[choice.color]}
                  <small className="block font-mono text-[12px] font-normal text-muted">{choice.hint(habit)}</small>
                  {warn && <small className="block font-mono text-[11px] leading-tight text-yellow-ink" aria-hidden="true">restarts streak</small>}
                </span>
                {saved === choice.color && <span aria-hidden="true" className="font-mono text-[11px] tracking-[0.14em] text-muted">SAVED</span>}
              </button>
            )
          })}
        </div>
        {yellowResets && (
          <p id={resetId} className="sr-only">You've used {yellowLimit} minimums in a row; another restarts the streak.</p>
        )}
        {noteOpen ? (
          <>
            <label htmlFor="check-in-note" className="mt-4 mb-1.5 block text-[13px] font-medium text-muted">
              Note (optional)
            </label>
            {/* Focus only when opened by "+ Add note"; an existing note shouldn't pop the keyboard. */}
            <textarea id="check-in-note" rows={2} maxLength={500} value={note} autoFocus={!cell.note}
              onChange={(e) => setNote(e.target.value)} className={underlineInput} />
          </>
        ) : (
          <button type="button" onClick={() => setNoteOpen(true)}
            className={`${textButton} mt-2`}>+ Add note</button>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-cell-red">{error}</p>}
        {saved && (
          <div className="mt-5 flex items-center gap-2">
            <button type="button" disabled={busy}
              className={`${textButton} text-cell-red!`}
              onClick={() => void run(() => clearCheckIn.mutateAsync(key))}>Clear</button>
            {noteChanged && (
              <button type="button" disabled={busy} className={`${inkButton} ml-auto`}
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
