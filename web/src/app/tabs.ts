export interface Tab { to: string; label: string; end: boolean }

/** Order of the top nav, the tab bar, and tab swipes. */
export const TABS: readonly Tab[] = [
  { to: '/', label: 'Today', end: true },
  { to: '/progress', label: 'Progress', end: false },
  { to: '/habits', label: 'Habits', end: false },
  { to: '/settings', label: 'Me', end: false },
]

/** −1 when the path isn't a tab. */
export function tabIndex(pathname: string): number {
  return TABS.findIndex((tab) => tab.to === pathname)
}
