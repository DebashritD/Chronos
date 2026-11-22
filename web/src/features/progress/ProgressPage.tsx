import { pageTitle } from '../../lib/ui'
import { WeekPanel } from './WeekPanel'

export function ProgressPage() {
  return (
    <section className="max-w-5xl">
      <h1 className={`${pageTitle} mb-5`}>Progress</h1>
      <WeekPanel />
    </section>
  )
}

export default ProgressPage
