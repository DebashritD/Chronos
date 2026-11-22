import { useState, type FormEvent } from 'react'
import { messageFor } from '../../api/errors'
import type { Frequency, Habit, NewHabit } from '../../api/types'
import { card, inputClass, primaryButton, secondaryButton } from '../../lib/ui'

interface HabitFormProps {
  /** When set, the form edits this habit's texts; schedule fields are hidden (they're immutable). */
  habit?: Habit
  submitLabel: string
  onSubmit(values: NewHabit): Promise<unknown>
  onCancel(): void
}

export function HabitForm({ habit, submitLabel, onSubmit, onCancel }: HabitFormProps) {
  const [name, setName] = useState(habit?.name ?? '')
  const [minText, setMinText] = useState(habit?.minText ?? '')
  const [targetText, setTargetText] = useState(habit?.targetText ?? '')
  const [frequency, setFrequency] = useState<Frequency>('DAILY')
  const [intervalDays, setIntervalDays] = useState('2')
  const [startDate, setStartDate] = useState('')
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
      })
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setSubmitting(false)
    }
  }

  const field = 'mb-3 flex flex-col gap-1.5'
  const label = 'text-[13px] font-medium text-muted'
  return (
    <form onSubmit={(event) => void handleSubmit(event)} className={`${card} mb-4`}>
      <div className={field}>
        <label htmlFor="habit-name" className={label}>Name</label>
        <input id="habit-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)}
          className={inputClass} />
      </div>
      <div className={field}>
        <label htmlFor="habit-min" className={label}>Bare minimum (YELLOW)</label>
        <input id="habit-min" required maxLength={200} value={minText} onChange={(e) => setMinText(e.target.value)}
          className={inputClass} />
      </div>
      <div className={field}>
        <label htmlFor="habit-target" className={label}>Target (GREEN)</label>
        <input id="habit-target" required maxLength={200} value={targetText}
          onChange={(e) => setTargetText(e.target.value)} className={inputClass} />
      </div>
      {!habit && (
        <>
          <div className={field}>
            <label htmlFor="habit-frequency" className={label}>Frequency</label>
            <select id="habit-frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}
              className={inputClass}>
              <option value="DAILY">Daily</option>
              <option value="EVERY_N_DAYS">Every N days</option>
              <option value="WEEKLY">Weekly (once per Mon–Sun week)</option>
            </select>
          </div>
          {frequency === 'EVERY_N_DAYS' && (
            <div className={field}>
              <label htmlFor="habit-interval" className={label}>Every how many days?</label>
              <input id="habit-interval" type="number" min={2} max={365} required value={intervalDays}
                onChange={(e) => setIntervalDays(e.target.value)} className={inputClass} />
            </div>
          )}
          <div className={field}>
            <label htmlFor="habit-start" className={label}>Start date (optional, defaults to today)</label>
            <input id="habit-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className={inputClass} />
          </div>
        </>
      )}
      {error && <p role="alert" className="mb-3 text-sm text-cell-red">{error}</p>}
      <div className="mt-1 flex gap-2">
        <button type="submit" disabled={submitting} className={primaryButton}>{submitLabel}</button>
        <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
      </div>
    </form>
  )
}

export default HabitForm
