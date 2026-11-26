export interface Tab { to: string; label: string; end: boolean; also?: string[] }

/** Order of the top nav, the tab bar, and tab swipes. */
export const TABS: readonly Tab[] = [
  { to: '/', label: 'Today', end: true },
  { to: '/tasks', label: 'Tasks', end: false },
  { to: '/progress', label: 'Progress', end: false },
  { to: '/settings', label: 'Me', end: false, also: ['/habits'] },
]

/** −1 when the path isn't a tab. */
export function tabIndex(pathname: string): number {
  return TABS.findIndex((tab) => tab.to === pathname)
}

/** Me stays lit on its sub-page (Manage habits). */
export function isTabActive(tab: Tab, pathname: string): boolean {
  return tab.end ? pathname === tab.to : pathname === tab.to || pathname.startsWith(`${tab.to}/`) || (tab.also ?? []).includes(pathname)
}
