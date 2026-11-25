import type { ReactNode } from 'react'
import { Mark } from './Mark'

/** A Minimum leading into two Targets: the "keep it off red" idea in one line, as on the app icon. */
function RunArt() {
  return (
    <div aria-hidden="true" className="mx-auto mb-5 flex w-fit items-center">
      <Mark kind="YELLOW" size={20} />
      <span className="h-[1.5px] w-7 bg-cell-yellow opacity-60" />
      <Mark kind="GREEN" size={20} />
      <span className="h-[1.5px] w-7 bg-cell-green opacity-60" />
      <Mark kind="GREEN" size={20} />
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action: ReactNode }) {
  return (
    <section aria-label={title} className="my-4 border-y border-rule-2 px-2 py-10 text-center">
      <RunArt />
      <h2 className="font-serif text-[30px] leading-tight text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted">{children}</p>
      <div className="mt-6">{action}</div>
    </section>
  )
}
