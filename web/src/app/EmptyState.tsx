import type { ReactNode } from 'react'
import { card } from '../lib/ui'

const CHAIN = ['bg-cell-grey', 'bg-cell-grey', 'bg-cell-yellow', 'bg-cell-green', 'bg-cell-green', 'bg-cell-green', 'bg-cell-green']

/** A week of cells warming from grey to green: the "keep the chain green" idea in one picture. */
function ChainArt() {
  return (
    <div aria-hidden="true" className="relative mx-auto mb-6 w-fit">
      <div className="absolute inset-0 -z-10 rounded-full bg-cell-green/20 blur-2xl" />
      <div className="flex items-end gap-1.5">
        {CHAIN.map((color, i) => (
          <span key={i} className={`w-6 rounded-[8px] ${color}`} style={{ height: 18 + i * 5 }} />
        ))}
      </div>
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action: ReactNode }) {
  return (
    <section aria-label={title} className={`${card} px-6 py-10 text-center`}>
      <ChainArt />
      <h2 className="text-[20px] font-semibold text-fg">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-muted">{children}</p>
      <div className="mt-6">{action}</div>
    </section>
  )
}
