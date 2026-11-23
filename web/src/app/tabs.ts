import { AccountIcon, HabitsIcon, ProgressIcon, TodayIcon, type TabIcon } from './TabIcons'

export interface Tab { to: string; label: string; icon: TabIcon; end: boolean }

/** Order of the sidebar, the tab bar, and tab swipes. */
export const TABS: readonly Tab[] = [
  { to: '/', label: 'Today', icon: TodayIcon, end: true },
  { to: '/progress', label: 'Progress', icon: ProgressIcon, end: false },
  { to: '/habits', label: 'Habits', icon: HabitsIcon, end: false },
  { to: '/settings', label: 'Account', icon: AccountIcon, end: false },
]

/** −1 when the path isn't a tab. */
export function tabIndex(pathname: string): number {
  return TABS.findIndex((tab) => tab.to === pathname)
}
