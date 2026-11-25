import type { Distribution } from '../../api/types'
import { Mark } from '../../app/Mark'
import type { MarkKind } from '../../lib/cells'
import { eyebrow } from '../../lib/ui'

const PARTS: { key: keyof Omit<Distribution, 'total'>; label: string; kind: MarkKind; bar: string; text: string }[] = [
  { key: 'green', label: 'Target', kind: 'GREEN', bar: 'bg-cell-green', text: 'text-cell-green' },
  { key: 'yellow', label: 'Minimum', kind: 'YELLOW', bar: 'bg-cell-yellow', text: 'text-yellow-ink' },
  { key: 'red', label: 'Missed', kind: 'RED', bar: 'bg-cell-red', text: 'text-cell-red' },
  { key: 'grey', label: 'Unmarked', kind: 'OPEN', bar: 'hatched', text: 'text-muted' },
]

/** % Target as a big numeral, one stacked bar, and a count per shape. */
export function DistributionBar({ title, caption, distribution }: { title: string; caption: string; distribution: Distribution }) {
  const { total } = distribution
  const target = total === 0 ? null : Math.round((distribution.green * 100) / total)
  return (
    <section aria-label={title} className="mt-8 border-t border-rule-2 pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={eyebrow}>{title}</h2>
        <span className="font-mono text-[12px] text-muted">{caption}</span>
      </div>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="font-serif text-[64px] leading-none text-ink">{target === null ? '–' : `${target}%`}</span>
        <span className="font-serif text-[22px] text-muted italic">target</span>
      </p>
      <div aria-hidden="true" className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-paper-2">
        {PARTS.map(({ key, bar }) => distribution[key] > 0 && <span key={key} className={bar} style={{ flex: distribution[key] }} />)}
      </div>
      {total === 0 && <p className="mt-2 text-[14px] text-muted">Nothing marked yet</p>}
      <ul className="mt-3 flex flex-wrap justify-between gap-x-2 gap-y-1 font-mono text-[12px] font-medium">
        {PARTS.map(({ key, label, kind, text }) => (
          <li key={key} aria-label={`${label} ${distribution[key]}`} className={`flex items-center gap-1 ${text}`}>
            <Mark kind={kind} size={10} />
            {distribution[key]} {label.toLowerCase()}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default DistributionBar
