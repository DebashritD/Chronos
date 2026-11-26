import type { ReactElement } from 'react'
import { AccountPage } from '../features/account/AccountPage'
import { ProgressPage } from '../features/progress/ProgressPage'
import { TasksPage } from '../features/tasks/TasksPage'
import { TodayPage } from '../features/today/TodayPage'

/** The neighbour drawn beside the current tab while swiping. Separate from tabs.ts to avoid an import cycle. */
export function renderTabPage(to: string): ReactElement | null {
  switch (to) {
    case '/': return <TodayPage />
    case '/tasks': return <TasksPage />
    case '/progress': return <ProgressPage />
    case '/settings': return <AccountPage />
    default: return null
  }
}
