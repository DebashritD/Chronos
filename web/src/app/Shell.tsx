import { NavLink } from 'react-router'
import { Logo } from './Logo'
import { SwipeTabs } from './SwipeTabs'
import { TABS } from './tabs'
import { WakingNotice } from './WakingNotice'
import { SyncToast } from './SyncToast'

function topTabClass({ isActive }: { isActive: boolean }): string {
  return `flex h-full items-center border-b-2 text-[14px] font-semibold transition-colors ${
    isActive ? 'border-accent text-paper' : 'border-transparent text-paper/65 hover:text-paper'
  }`
}

/**
 * The pad: a dark binding on top (wordmark and tabs on desktop, punched holes on phones), one paper sheet below,
 * and on phones a text tab bar at the bottom. Logout lives on Me.
 */
export function Shell() {
  return (
    <div className="min-h-screen bg-paper-2 text-ink">
      <header className="binding sticky top-0 z-10 pt-[env(safe-area-inset-top)] md:bg-none">
        <div className="mx-auto flex h-9 max-w-[1080px] items-center px-6 md:h-14 md:px-10">
          <span className="hidden text-paper md:block"><Logo /></span>
          <nav aria-label="Primary" className="ml-auto hidden h-full gap-8 md:flex">
            {TABS.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={topTabClass}>{label}</NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="perforated sheet-edges mx-auto w-full max-w-[1080px] bg-paper px-6 pt-7 pb-[calc(5.5rem+env(safe-area-inset-bottom))] max-md:flex max-md:min-h-[calc(100dvh-2.25rem)] max-md:flex-col md:mb-10 md:px-10 md:pt-10 md:pb-12">
        <SwipeTabs />
      </main>
      <WakingNotice />
      <SyncToast />
      <nav aria-label="Tabs"
        className="fixed inset-x-0 bottom-0 z-10 flex h-[calc(3.75rem+env(safe-area-inset-bottom))] border-t border-rule-2 bg-paper-2 pb-[env(safe-area-inset-bottom)] md:hidden">
        {TABS.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} className="flex flex-1 items-center justify-center">
            {({ isActive }) => (
              <span className={`border-b-2 pb-1 text-[13px] font-semibold ${isActive ? 'border-accent text-ink' : 'border-transparent text-muted'}`}>
                {label}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default Shell
