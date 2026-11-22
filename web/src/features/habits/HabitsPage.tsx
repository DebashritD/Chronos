import { Plus } from 'lucide-react'
import { useState } from 'react'
import { messageFor } from '../../api/errors'
import type { Habit } from '../../api/types'
import { habitSummary } from '../../lib/cells'
import { eyebrow, pageTitle, pillButton } from '../../lib/ui'
import { useCreateHabit, useHabitAction, useHabits, useUpdateHabit, type HabitAction } from './api'
import { HabitForm } from './HabitForm'

export function HabitsPage() {
  const current = useHabits()
  const archived = useHabits('ARCHIVED')
  const createHabit = useCreateHabit()
  const updateHabit = useUpdateHabit()
  const habitAction = useHabitAction()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(id: number, action: HabitAction): Promise<void> {
    setError(null)
    try {
      await habitAction.mutateAsync({ id, action })
    } catch (err) {
      setError(messageFor(err))
    }
  }

  function row(habit: Habit) {
    if (editingId === habit.id) {
      return (
        <li key={habit.id} aria-label={habit.name}>
          <HabitForm habit={habit} submitLabel="Save" onCancel={() => setEditingId(null)}
            onSubmit={async ({ name, minText, targetText }) => {
              await updateHabit.mutateAsync({ id: habit.id, name, minText, targetText })
              setEditingId(null)
            }} />
        </li>
      )
    }
    const isArchived = habit.status === 'ARCHIVED'
    const isPaused = habit.status === 'PAUSED'
    return (
      <li key={habit.id} aria-label={habit.name}
        className={`flex flex-wrap items-center gap-3 px-4 py-3.5 ${isArchived || isPaused ? 'opacity-60' : ''}`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[16px] font-semibold text-fg">{habit.name}</span>
            {isPaused && (
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
                Paused
              </span>
            )}
          </div>
          <p className="truncate text-[13px] text-muted">{habitSummary(habit)}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {isArchived ? (
            <button type="button" aria-label={`Unarchive ${habit.name}`} className={pillButton}
              onClick={() => void act(habit.id, 'unarchive')}>Unarchive</button>
          ) : (
            <>
              <button type="button" aria-label={`Edit ${habit.name}`} className={pillButton}
                onClick={() => setEditingId(habit.id)}>Edit</button>
              {isPaused ? (
                <button type="button" aria-label={`Resume ${habit.name}`} className={pillButton}
                  onClick={() => void act(habit.id, 'resume')}>Resume</button>
              ) : (
                <button type="button" aria-label={`Pause ${habit.name}`} className={pillButton}
                  onClick={() => void act(habit.id, 'pause')}>Pause</button>
              )}
              <button type="button" aria-label={`Archive ${habit.name}`} className={pillButton}
                onClick={() => void act(habit.id, 'archive')}>Archive</button>
            </>
          )}
        </div>
      </li>
    )
  }

  const list = 'divide-y divide-line overflow-hidden rounded-card border border-line bg-card'
  return (
    <section className="max-w-3xl">
      <div className="mb-6 flex items-end justify-between">
        <h1 className={pageTitle}>Habits</h1>
        {!creating && (
          <button type="button" aria-label="New habit" onClick={() => setCreating(true)}
            className="fixed right-5 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg shadow-accent/30 md:static md:h-auto md:w-auto md:gap-2 md:rounded-[14px] md:px-4 md:py-2.5 md:text-sm md:font-semibold md:shadow-none">
            <Plus size={24} strokeWidth={2.5} aria-hidden="true" />
            <span className="hidden md:inline">New habit</span>
          </button>
        )}
      </div>
      {creating && (
        <HabitForm submitLabel="Create habit" onCancel={() => setCreating(false)}
          onSubmit={async (values) => {
            await createHabit.mutateAsync(values)
            setCreating(false)
          }} />
      )}
      {error && <p role="alert" className="mb-3 text-sm text-cell-red">{error}</p>}
      {current.isPending && <p className="text-muted">Loading…</p>}
      {current.data?.length === 0 && !creating && <p className="text-muted">No habits yet. Create your first one.</p>}
      {current.data && current.data.length > 0 && <ul className={list}>{current.data.map(row)}</ul>}
      {archived.data && archived.data.length > 0 && (
        <details className="mt-8">
          <summary className={`${eyebrow} cursor-pointer`}>Archived ({archived.data.length})</summary>
          <ul className={`${list} mt-3`}>{archived.data.map(row)}</ul>
        </details>
      )}
    </section>
  )
}

export default HabitsPage
