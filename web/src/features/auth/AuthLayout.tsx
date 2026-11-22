import type { ReactNode } from 'react'
import { Logo } from '../../app/Logo'

/** Shared frame for log-in and sign-up: logo tile, headline, tagline, then the form. */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 py-10">
      <div className="w-full max-w-sm">
        <Logo size="lg" />
        <h1 className="mt-7 text-[34px] leading-[1.1] font-extrabold tracking-tight text-fg">
          Never two reds<br />in a row.
        </h1>
        <p className="mt-2.5 mb-7 text-[15px] leading-normal text-muted">
          Mark each habit green, yellow or red. Keep the chain alive.
        </p>
        <h2 className="sr-only">{title}</h2>
        {children}
      </div>
    </main>
  )
}

export default AuthLayout
