import type { ReactElement } from 'react'
import { AccountPage } from '../features/account/AccountPage'
import { HabitsPage } from '../features/habits/HabitsPage'
import { ProgressPage } from '../features/progress/ProgressPage'
import { TodayPage } from '../features/today/TodayPage'

/** The neighbour drawn beside the current tab while swiping. Separate from tabs.ts to avoid an import cycle. */
export function renderTabPage(to: string): ReactElement | null {
  switch (to) {
    case '/': return <TodayPage />
    case '/progress': return <ProgressPage />
    case '/habits': return <HabitsPage />
    case '/settings': return <AccountPage />
    default: return null
  }
}
