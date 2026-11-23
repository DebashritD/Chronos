import type { Distribution } from '../../api/types'
import { card, cardTitle } from '../../lib/ui'

const SEGMENTS = [
  { key: 'green', label: 'Green', stroke: 'var(--color-cell-green)', dot: 'bg-cell-green' },
  { key: 'yellow', label: 'Yellow', stroke: 'var(--color-cell-yellow)', dot: 'bg-cell-yellow' },
  { key: 'red', label: 'Red', stroke: 'var(--color-cell-red)', dot: 'bg-cell-red' },
  { key: 'grey', label: 'Unmarked', stroke: 'var(--color-cell-grey)', dot: 'bg-cell-grey' },
] as const

/** r = 15.9155 gives a circumference of 100, so dash lengths are percentages. */
const RADIUS = 15.9155

export function DistributionDonut({ title, distribution }: { title: string; distribution: Distribution }) {
  const { total } = distribution
  const shares = SEGMENTS.map(({ key }) => (total === 0 ? 0 : (distribution[key] * 100) / total))
  const starts = shares.map((_, i) => shares.slice(0, i).reduce((sum, share) => sum + share, 0))

  return (
    <section aria-label={title} className={card}>
      <h2 className={cardTitle}>{title}</h2>
      <div className="flex items-center gap-6">
        <div className="relative h-28 w-28 flex-none">
          <svg viewBox="0 0 36 36" className="h-full w-full" aria-hidden="true">
            <circle cx="18" cy="18" r={RADIUS} fill="none" stroke="var(--color-surface)" strokeWidth="4" />
            {SEGMENTS.map(({ key, stroke }, i) =>
              shares[i] > 0 ? (
                <circle key={key} cx="18" cy="18" r={RADIUS} fill="none" stroke={stroke} strokeWidth="4"
                  strokeDasharray={`${shares[i]} ${100 - shares[i]}`} strokeDashoffset={25 - starts[i]} />
              ) : null,
            )}
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[20px] font-extrabold text-fg">{total === 0 ? '–' : `${Math.round(shares[0])}%`}</span>
            <span className="text-[11px] font-semibold tracking-wider text-muted uppercase">green</span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          {total === 0 && <p className="mb-2 text-sm text-muted">Nothing marked yet</p>}
          <ul className="flex flex-col gap-2">
            {SEGMENTS.map(({ key, label, dot }) => (
              <li key={key} aria-label={`${label} ${distribution[key]}`} className="flex items-center gap-2 text-sm">
                <span className={`h-2.5 w-2.5 flex-none rounded-full ${dot}`} aria-hidden="true" />
                <span className="flex-1 text-muted">{label}</span>
                <span className="font-semibold text-fg">{distribution[key]}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export default DistributionDonut
