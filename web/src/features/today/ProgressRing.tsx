interface ProgressRingProps {
  green: number
  yellow: number
  red: number
  total: number
}

const SEGMENTS = [
  { key: 'green', stroke: 'var(--color-cell-green)', label: 'target' },
  { key: 'yellow', stroke: 'var(--color-cell-yellow)', label: 'minimum' },
  { key: 'red', stroke: 'var(--color-cell-red)', label: 'missed' },
] as const

/** Today's marks as green / yellow / red arcs around "N/M"; r = 15.9155 makes the circumference 100. */
export function ProgressRing({ total, ...counts }: ProgressRingProps) {
  const marked = counts.green + counts.yellow + counts.red
  const breakdown = SEGMENTS.filter(({ key }) => counts[key] > 0).map(({ key, label }) => `${counts[key]} ${label}`)
  // A small gap between arcs keeps adjacent colours readable; skip it when one colour fills the ring.
  const gap = breakdown.length > 1 ? 1.5 : 0
  const shares = SEGMENTS.map(({ key }) => (total === 0 ? 0 : (counts[key] * 100) / total))
  const starts = shares.map((_, i) => shares.slice(0, i).reduce((sum, share) => sum + share, 0))
  return (
    <div role="img" aria-label={`${marked} of ${total} marked${breakdown.length ? ` (${breakdown.join(', ')})` : ''}`}
      className="relative h-[72px] w-[72px] flex-none">
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--color-surface)" strokeWidth="3.6" />
        {SEGMENTS.map(({ key, stroke }, i) =>
          shares[i] > 0 ? (
            <circle key={key} cx="18" cy="18" r="15.9155" fill="none" stroke={stroke} strokeWidth="3.6"
              strokeDasharray={`${Math.max(shares[i] - gap, 0.5)} 100`} strokeDashoffset={-starts[i]}
              className="transition-[stroke-dasharray,stroke-dashoffset] duration-500 ease-out" />
          ) : null,
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-[19px] leading-none font-extrabold text-fg"
        aria-hidden="true">
        {marked}/{total}
      </span>
    </div>
  )
}

export default ProgressRing
