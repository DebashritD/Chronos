import { Archive, ArchiveRestore, Pause, Pencil, Play, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { messageFor } from '../../api/errors'
import type { Habit } from '../../api/types'
import { frequencyLabel } from '../../lib/cells'
import { formatDayMonth } from '../../lib/dates'
import { EmptyState } from '../../app/EmptyState'
import { Mark } from '../../app/Mark'
import { useIsNeighbour } from '../../app/neighbour'
import { inkButton, eyebrow, iconButton, pageTitle } from '../../lib/ui'
import { MOBILE_QUERY, useMediaQuery } from '../../lib/useMediaQuery'
import { useSession } from '../auth/session'
import { useStreaks } from '../stats/api'
import { useCreateHabit, useHabitAction, useHabits, useUpdateHabit, type HabitAction } from './api'
import { HabitForm } from './HabitForm'

const mutedIconButton = iconButton.replace('text-ink', 'text-muted')

function IconButton({ label, title, onClick, children }: { label: string; title: string; onClick(): void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={title} onClick={onClick} className={mutedIconButton}>
      {children}
    </button>
  )
}

function Rule({ kind, term, detail }: { kind: 'GREEN' | 'YELLOW'; term: string; detail: string }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="sr-only">{term}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-[14px] break-words text-ink"><Mark kind={kind} size={11} />{detail}</dd>
    </div>
  )
}

export function HabitsPage() {
  const { me } = useSession()
  const current = useHabits()
  const archived = useHabits('ARCHIVED')
  const createHabit = useCreateHabit()
  const updateHabit = useUpdateHabit()
  const habitAction = useHabitAction()
  const streaks = useStreaks()
  const [creating, setCreating] = useState(false)
  const mobile = useMediaQuery(MOBILE_QUERY)
  const neighbour = useIsNeighbour()
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
            onSubmit={async ({ name, minText, targetText, yellowCap }) => {
              await updateHabit.mutateAsync({ id: habit.id, name, minText, targetText, yellowCap })
              setEditingId(null)
            }} />
        </li>
      )
    }
    const isArchived = habit.status === 'ARCHIVED'
    const isPaused = habit.status === 'PAUSED'
    const run = streaks.data?.find((s) => s.habitId === habit.id)?.current
    return (
      <li key={habit.id} aria-label={habit.name}
        className={`flex items-start gap-2 border-b border-rule py-4 ${isArchived || isPaused ? 'opacity-50' : ''}`}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-serif text-[27px] leading-tight break-words text-ink">{habit.name}</h2>
            {isPaused && <span className="stamp -rotate-6 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-[0.14em] text-accent uppercase">Paused</span>}
          </div>
          <p className="mt-1.5 font-mono text-[11px] text-muted">
            {frequencyLabel(habit.frequency, habit.intervalDays).toLowerCase()} · since {formatDayMonth(habit.startDate)}
            {!isArchived && run !== undefined && <> · <b className="font-medium text-ink">{run}</b> run</>}
            {habit.yellowCap && ` · ≤${me?.maxYellows ?? 2} minimums`}
          </p>
          <dl className="mt-2 grid gap-1">
            <Rule kind="GREEN" term="Target" detail={habit.targetText} />
            <Rule kind="YELLOW" term="Minimum" detail={habit.minText} />
          </dl>
        </div>
        <div className="flex flex-none">
          {isArchived ? (
            <IconButton label={`Unarchive ${habit.name}`} title="Restore" onClick={() => void act(habit.id, 'unarchive')}>
              <ArchiveRestore size={20} strokeWidth={1.6} aria-hidden="true" />
            </IconButton>
          ) : (
            <>
              <IconButton label={`Edit ${habit.name}`} title="Edit" onClick={() => setEditingId(habit.id)}>
                <Pencil size={20} strokeWidth={1.6} aria-hidden="true" />
              </IconButton>
              {isPaused ? (
                <IconButton label={`Resume ${habit.name}`} title="Resume" onClick={() => void act(habit.id, 'resume')}>
                  <Play size={20} strokeWidth={1.6} aria-hidden="true" />
                </IconButton>
              ) : (
                <IconButton label={`Pause ${habit.name}`} title="Pause" onClick={() => void act(habit.id, 'pause')}>
                  <Pause size={20} strokeWidth={1.6} aria-hidden="true" />
                </IconButton>
              )}
              <IconButton label={`Archive ${habit.name}`} title="Stop (archive)" onClick={() => void act(habit.id, 'archive')}>
                <Archive size={20} strokeWidth={1.6} aria-hidden="true" />
              </IconButton>
            </>
          )}
        </div>
      </li>
    )
  }

  const list = 'flex flex-col'
  const newHabitButton = (
    <button type="button" aria-label="New habit" onClick={() => setCreating(true)}
      className="fixed right-5 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-semibold text-paper shadow-[0_6px_18px_rgb(29_27_24/0.25)] md:static md:h-11 md:shadow-none">
      <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
      New habit
    </button>
  )
  return (
    <section className="max-w-3xl pb-20 md:pb-0">
      <div className="flex items-end justify-between border-b border-rule-2 pb-4">
        <div>
          <p className={eyebrow}>Your pad</p>
          <h1 className={pageTitle}>Habits</h1>
        </div>
        {!creating && !mobile && newHabitButton}
      </div>
      {/* On a phone the button floats on the body: a swiping track's transform would otherwise carry it along. */}
      {!creating && mobile && !neighbour && createPortal(newHabitButton, document.body)}
      {creating && (
        <HabitForm submitLabel="Create habit" onCancel={() => setCreating(false)}
          onSubmit={async (values) => {
            await createHabit.mutateAsync(values)
            setCreating(false)
          }} />
      )}
      {error && <p role="alert" className="mb-3 text-sm text-cell-red">{error}</p>}
      {current.isPending && <p className="text-muted">Loading…</p>}
      {current.data?.length === 0 && !creating && (
        <EmptyState title="No habits yet"
          action={<button type="button" className={inkButton} onClick={() => setCreating(true)}>Create your first habit</button>}>
          Start small: a minimum you can do on your worst day, and a target for your best.
        </EmptyState>
      )}
      {current.data && current.data.length > 0 && <ul className={list}>{current.data.map(row)}</ul>}
      {archived.data && archived.data.length > 0 && (
        <details className="mt-8">
          <summary className={`${eyebrow} flex min-h-11 cursor-pointer items-center text-muted`}>Archived ({archived.data.length})</summary>
          <ul className={`${list} mt-3`}>{archived.data.map(row)}</ul>
        </details>
      )}
    </section>
  )
}

export default HabitsPage
