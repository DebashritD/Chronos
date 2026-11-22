import { ArchiveRestore, Pause, Pencil, Play, Plus, Square } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { messageFor } from '../../api/errors'
import type { Habit } from '../../api/types'
import { frequencyLabel } from '../../lib/cells'
import { formatDay } from '../../lib/dates'
import { card, eyebrow, pageTitle } from '../../lib/ui'
import { useCreateHabit, useHabitAction, useHabits, useUpdateHabit, type HabitAction } from './api'
import { HabitForm } from './HabitForm'

function IconButton({ label, title, onClick, children }: { label: string; title: string; onClick(): void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={title} onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-fg transition-transform active:scale-95">
      {children}
    </button>
  )
}

function Rule({ swatch, term, detail }: { swatch: string; term: string; detail: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] bg-surface px-3 py-2.5">
      <span className={`h-4 w-4 flex-none rounded-[5px] ${swatch}`} aria-hidden="true" />
      <dt className="sr-only">{term}</dt>
      <dd className="min-w-0 text-[15px] break-words text-fg">{detail}</dd>
    </div>
  )
}

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
      <li key={habit.id} aria-label={habit.name} className={`${card} ${isArchived || isPaused ? 'opacity-60' : ''}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[20px] font-bold break-words text-fg">{habit.name}</h2>
            {isPaused && (
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
                Paused
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            {frequencyLabel(habit.frequency, habit.intervalDays)} · since {formatDay(habit.startDate)}
          </p>
        </div>
        <dl className="mt-4 grid gap-2">
          <Rule swatch="bg-cell-green" term="Green" detail={habit.targetText} />
          <Rule swatch="bg-cell-yellow" term="Yellow" detail={habit.minText} />
        </dl>
        <div className="mt-4 flex justify-end gap-2">
          {isArchived ? (
            <IconButton label={`Unarchive ${habit.name}`} title="Restore" onClick={() => void act(habit.id, 'unarchive')}>
              <ArchiveRestore size={18} aria-hidden="true" />
            </IconButton>
          ) : (
            <>
              <IconButton label={`Edit ${habit.name}`} title="Edit" onClick={() => setEditingId(habit.id)}>
                <Pencil size={18} aria-hidden="true" />
              </IconButton>
              {isPaused ? (
                <IconButton label={`Resume ${habit.name}`} title="Resume" onClick={() => void act(habit.id, 'resume')}>
                  <Play size={18} aria-hidden="true" />
                </IconButton>
              ) : (
                <IconButton label={`Pause ${habit.name}`} title="Pause" onClick={() => void act(habit.id, 'pause')}>
                  <Pause size={18} aria-hidden="true" />
                </IconButton>
              )}
              <IconButton label={`Archive ${habit.name}`} title="Stop (archive)" onClick={() => void act(habit.id, 'archive')}>
                <Square size={16} aria-hidden="true" />
              </IconButton>
            </>
          )}
        </div>
      </li>
    )
  }

  const list = 'grid grid-cols-1 gap-3'
  return (
    <section className="max-w-3xl pb-20 md:pb-0">
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
