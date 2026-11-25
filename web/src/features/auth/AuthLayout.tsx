import type { ReactNode } from 'react'
import { Logo } from '../../app/Logo'

/** Shared frame for log-in and sign-up: a pad sheet with the logo, headline, tagline, then the form. */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper-2">
      <div aria-hidden="true" className="binding h-[calc(2.25rem+env(safe-area-inset-top))]" />
      <main className="perforated mx-auto min-h-[calc(100dvh-2.25rem)] max-w-md bg-paper px-6 pt-10 pb-10">
        <span className="text-ink"><Logo size="lg" /></span>
        <h1 className="mt-8 font-display text-[38px] leading-[1.02] text-ink">Keep it<br />off red.</h1>
        <p className="mt-3 mb-8 text-[15px] leading-normal text-muted">
          Mark each habit Target, Minimum or Missed. Even the minimum keeps the chain alive.
        </p>
        <h2 className="sr-only">{title}</h2>
        {children}
      </main>
    </div>
  )
}

export default AuthLayout
