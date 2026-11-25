import { useId, useState, type FormEvent } from 'react'
import { messageFor } from '../../api/errors'
import type { Frequency, Habit, NewHabit } from '../../api/types'
import { inkButton, outlineButton, underlineInput } from '../../lib/ui'
import { useSession } from '../auth/session'

interface HabitFormProps {
  /** When set, the form edits this habit's texts and yellow limit; schedule fields are hidden (they're immutable). */
  habit?: Habit
  submitLabel: string
  onSubmit(values: NewHabit): Promise<unknown>
  onCancel(): void
  /** Drop the ruled frame, for when the form sits in its own sheet. */
  bare?: boolean
}

export function HabitForm({ habit, submitLabel, onSubmit, onCancel, bare = false }: HabitFormProps) {
  const { me } = useSession()
  const yellowCapId = useId()
  const [name, setName] = useState(habit?.name ?? '')
  const [minText, setMinText] = useState(habit?.minText ?? '')
  const [targetText, setTargetText] = useState(habit?.targetText ?? '')
  const [frequency, setFrequency] = useState<Frequency>('DAILY')
  const [intervalDays, setIntervalDays] = useState('2')
  const [startDate, setStartDate] = useState('')
  const [yellowCap, setYellowCap] = useState(habit?.yellowCap ?? true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        name,
        minText,
        targetText,
        frequency,
        intervalDays: frequency === 'EVERY_N_DAYS' ? Number(intervalDays) : undefined,
        startDate: startDate || undefined,
        yellowCap,
      })
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setSubmitting(false)
    }
  }

  const field = 'mb-3 flex flex-col gap-1.5'
  const label = 'text-[11px] font-semibold tracking-[0.22em] text-muted uppercase'
  return (
    <form onSubmit={(event) => void handleSubmit(event)} className={bare ? undefined : 'mb-6 border-b border-rule-2 pb-6'}>
      <div className={field}>
        <label htmlFor="habit-name" className={label}>Name</label>
        <input id="habit-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)}
          className={underlineInput} />
      </div>
      <div className={field}>
        <label htmlFor="habit-min" className={label}>Minimum</label>
        <input id="habit-min" required maxLength={200} value={minText} onChange={(e) => setMinText(e.target.value)}
          className={underlineInput} />
      </div>
      <div className={field}>
        <label htmlFor="habit-target" className={label}>Target</label>
        <input id="habit-target" required maxLength={200} value={targetText}
          onChange={(e) => setTargetText(e.target.value)} className={underlineInput} />
      </div>
      {!habit && (
        <>
          <div className={field}>
            <label htmlFor="habit-frequency" className={label}>Frequency</label>
            <select id="habit-frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}
              className={`${underlineInput} select-chevron appearance-none bg-[length:12px] bg-no-repeat bg-[position:right_center] pr-6`}>
              <option value="DAILY">Daily</option>
              <option value="EVERY_N_DAYS">Every N days</option>
              <option value="WEEKLY">Weekly (once per Mon–Sun week)</option>
            </select>
          </div>
          {frequency === 'EVERY_N_DAYS' && (
            <div className={field}>
              <label htmlFor="habit-interval" className={label}>Every how many days?</label>
              <input id="habit-interval" type="number" min={2} max={365} required value={intervalDays}
                onChange={(e) => setIntervalDays(e.target.value)} className={underlineInput} />
            </div>
          )}
          <div className={field}>
            <label htmlFor="habit-start" className={label}>Start date (optional, defaults to today)</label>
            <input id="habit-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className={underlineInput} />
          </div>
        </>
      )}
      <label className="mb-4 flex items-start gap-3 py-2">
        <input type="checkbox" aria-labelledby={yellowCapId} aria-describedby={`${yellowCapId}-hint`}
          checked={yellowCap} onChange={(e) => setYellowCap(e.target.checked)}
          className="mt-0.5 h-5 w-5 accent-ink" />
        <span>
          <span id={yellowCapId} className="block text-[14px] font-medium text-ink">Limit minimums in a row</span>
          <span id={`${yellowCapId}-hint`} className="block text-[12px] text-muted">Up to {me?.maxYellows ?? 2} in a row keep your streak.</span>
        </span>
      </label>
      {error && <p role="alert" className="mb-3 text-sm text-cell-red">{error}</p>}
      <div className="mt-1 flex gap-2">
        <button type="submit" disabled={submitting} className={inkButton}>{submitLabel}</button>
        <button type="button" onClick={onCancel} className={outlineButton}>Cancel</button>
      </div>
    </form>
  )
}

export default HabitForm
