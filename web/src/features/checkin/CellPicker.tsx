import { useState } from 'react'
import { messageFor } from '../../api/errors'
import type { Color, WeekCell, WeekHabit } from '../../api/types'
import { cellClass, isColor, STATE_LABEL } from '../../lib/cells'
import { eyebrow, inputClass, primaryButton, secondaryButton } from '../../lib/ui'
import { useClearCheckIn, useSaveCheckIn } from '../stats/api'
import { periodLabel } from './period'

const CHOICES: { color: Color; hint(habit: WeekHabit): string }[] = [
  { color: 'GREEN', hint: (habit) => habit.targetText },
  { color: 'YELLOW', hint: (habit) => habit.minText },
  { color: 'RED', hint: () => "Didn't do it" },
]

interface CellPickerProps {
  habit: WeekHabit
  cell: WeekCell
  onClose(): void
}

/** Bottom sheet on phones, centred dialog on wider screens. Saves only on "Save"; Clear removes the check-in. */
export function CellPicker({ habit, cell, onClose }: CellPickerProps) {
  const saveCheckIn = useSaveCheckIn()
  const clearCheckIn = useClearCheckIn()
  const marked = isColor(cell.state)
  const [color, setColor] = useState<Color | null>(isColor(cell.state) ? cell.state : null)
  const [note, setNote] = useState(cell.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const busy = saveCheckIn.isPending || clearCheckIn.isPending
  const key = { habitId: habit.id, periodStart: cell.periodStart ?? cell.date }

  async function run(action: () => Promise<unknown>): Promise<void> {
    setError(null)
    try {
      await action()
      onClose()
    } catch (err) {
      setError(messageFor(err))
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}>
      <div role="dialog" aria-modal="true" aria-label={`${habit.name}, ${periodLabel(habit, cell)}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
        className="w-full rounded-t-[28px] border border-line bg-card px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:max-w-md md:rounded-[28px] md:pt-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline md:hidden" aria-hidden="true" />
        <p className={eyebrow}>{periodLabel(habit, cell)}</p>
        <h2 className="mt-0.5 mb-4 text-[22px] font-extrabold text-fg">{habit.name}</h2>
        <div className="flex flex-col gap-2">
          {CHOICES.map((choice) => (
            <button key={choice.color} type="button" aria-pressed={color === choice.color}
              onClick={() => setColor(choice.color)}
              className={`flex w-full items-center gap-3 rounded-2xl border bg-surface p-3.5 text-left ${
                color === choice.color ? 'border-accent' : 'border-line'
              }`}>
              <span className={`h-6 w-6 flex-none rounded-lg ${cellClass(choice.color)}`} aria-hidden="true" />
              <span className="text-[15px] font-semibold text-fg">
                {STATE_LABEL[choice.color]}
                <small className="block text-[13px] font-normal text-muted">{choice.hint(habit)}</small>
              </span>
            </button>
          ))}
        </div>
        <label htmlFor="check-in-note" className="mt-4 mb-1.5 block text-[13px] font-medium text-muted">
          Note (optional)
        </label>
        <textarea id="check-in-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
          className={inputClass} />
        {error && <p role="alert" className="mt-2 text-sm text-cell-red">{error}</p>}
        <div className="mt-5 flex items-center gap-2">
          {marked && (
            <button type="button" disabled={busy}
              className="rounded-[14px] border border-line bg-surface px-4 py-3 text-[15px] font-medium text-cell-red disabled:opacity-50"
              onClick={() => void run(() => clearCheckIn.mutateAsync(key))}>Clear</button>
          )}
          <button type="button" onClick={onClose} className={`${secondaryButton} ml-auto`}>Cancel</button>
          <button type="button" disabled={!color || busy} className={primaryButton}
            onClick={() => {
              if (color) void run(() => saveCheckIn.mutateAsync({ ...key, color, note: note.trim() || null }))
            }}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default CellPicker
