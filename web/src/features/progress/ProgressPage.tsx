import { useSearchParams } from 'react-router'
import { SyncStatus } from '../../app/SyncStatus'
import { pageTitle } from '../../lib/ui'
import { MonthPanel } from './MonthPanel'
import { WeekPanel } from './WeekPanel'

function segmentClass(active: boolean): string {
  return `flex-1 rounded-[10px] px-4 py-1.5 text-[14px] font-semibold transition-colors ${
    active ? 'bg-surface text-fg' : 'text-muted'
  }`
}

/** Week (default) or Month (`?view=month`); each panel keeps its own `start` / `month` parameter. */
export function ProgressPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const isMonth = searchParams.get('view') === 'month'

  return (
    <section className="max-w-5xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h1 className={pageTitle}>Progress</h1>
        <div role="group" aria-label="View" className="flex w-full rounded-xl bg-card p-1 md:w-64">
          <button type="button" aria-pressed={!isMonth} className={segmentClass(!isMonth)}
            onClick={() => setSearchParams({})}>Week</button>
          <button type="button" aria-pressed={isMonth} className={segmentClass(isMonth)}
            onClick={() => setSearchParams({ view: 'month' })}>Month</button>
        </div>
      </div>
      <SyncStatus />
      {isMonth ? <MonthPanel /> : <WeekPanel />}
    </section>
  )
}

export default ProgressPage
