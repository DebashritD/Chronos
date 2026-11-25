import { useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { SyncStatus } from '../../app/SyncStatus'
import { eyebrow } from '../../lib/ui'
import { MonthPanel } from './MonthPanel'
import { WeekPanel } from './WeekPanel'

function toggleClass(active: boolean): string {
  return `min-h-11 border-b-2 text-[15px] font-semibold transition-colors ${active ? 'border-accent text-ink' : 'border-transparent text-muted'}`
}

/** Week (default) or Month (`?view=month`); each panel keeps its own `start` / `month` parameter. */
export function ProgressPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const isMonth = searchParams.get('view') === 'month'
  const focusSelected = useRef(false)
  // Panels remount the toggle (also across their loading states), so refocus the selected button each time after a user switch.
  const focusOnMount = useCallback((el: HTMLButtonElement | null) => {
    if (el && focusSelected.current) el.focus()
  }, [])
  const switchTo = (params: Record<string, string>) => {
    focusSelected.current = true
    setSearchParams(params)
  }
  const toggle = (
    <div role="group" aria-label="View" className="mt-3 flex gap-6">
      <button type="button" ref={isMonth ? undefined : focusOnMount} aria-pressed={!isMonth} className={toggleClass(!isMonth)} onClick={() => switchTo({})}>Week</button>
      <button type="button" ref={isMonth ? focusOnMount : undefined} aria-pressed={isMonth} className={toggleClass(isMonth)} onClick={() => switchTo({ view: 'month' })}>Month</button>
    </div>
  )
  return (
    <section className="max-w-3xl">
      <h1 className={eyebrow}>Progress</h1>
      <SyncStatus className="mt-1" />
      {isMonth ? <MonthPanel toggle={toggle} /> : <WeekPanel toggle={toggle} />}
    </section>
  )
}

export default ProgressPage
