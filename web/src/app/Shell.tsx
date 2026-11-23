import { NavLink, Outlet } from 'react-router'
import { useSession } from '../features/auth/session'
import { Logo } from './Logo'
import { AccountIcon, HabitsIcon, ProgressIcon, TodayIcon, type TabIcon } from './TabIcons'
import { WakingNotice } from './WakingNotice'
import { SyncToast } from './SyncToast'

const NAV: { to: string; label: string; icon: TabIcon; end: boolean }[] = [
  { to: '/', label: 'Today', icon: TodayIcon, end: true },
  { to: '/progress', label: 'Progress', icon: ProgressIcon, end: false },
  { to: '/habits', label: 'Habits', icon: HabitsIcon, end: false },
  { to: '/settings', label: 'Account', icon: AccountIcon, end: false },
]

function sideClass({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${
    isActive ? 'bg-surface text-fg' : 'text-muted hover:text-fg'
  }`
}

function tabClass({ isActive }: { isActive: boolean }): string {
  return `flex flex-1 items-center justify-center ${isActive ? 'text-accent' : 'text-dim'}`
}

/** Desktop: fixed sidebar with a user chip. Mobile (< 768px): bottom tab bar. Logout lives on Account. */
export function Shell() {
  const { me } = useSession()

  return (
    <div className="min-h-screen bg-bg text-fg md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 flex-none flex-col border-r border-line px-4 py-6 md:flex">
        <div className="mb-8 px-2"><Logo /></div>
        <nav aria-label="Primary" className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={sideClass}>
              {({ isActive }) => (
                <>
                  <Icon size={20} active={isActive} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-2xl bg-card p-3">
          <span aria-hidden="true"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent text-sm font-bold text-bg">
            {me?.username.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-fg">{me?.username}</span>
            <span className="block truncate text-xs text-muted">{me?.timezone}</span>
          </span>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-10 md:pt-10 md:pb-10">
        <Outlet />
      </main>
      <WakingNotice />
      <SyncToast />
      <nav aria-label="Tabs"
        className="fixed inset-x-0 bottom-0 z-10 flex h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={tabClass}>
            {({ isActive }) => (
              <>
                <Icon size={26} active={isActive} />
                <span className="sr-only">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default Shell
