import type { MarkKind } from '../lib/cells'

/** One state as a shape (● ◐ ✕ ○ –), so state never relies on colour. Decorative: callers carry the label. */
export function Mark({ kind, dim = false, size = 16 }: { kind: MarkKind; dim?: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" data-mark={kind} data-dim={dim ? '' : undefined}
      className={`relative block flex-none ${dim ? 'opacity-30' : ''}`}>
      {kind === 'GREEN' && <circle cx="8" cy="8" r="7.5" className="fill-cell-green" />}
      {kind === 'YELLOW' && (
        <>
          <circle cx="8" cy="8" r="6.7" strokeWidth="1.6" className="fill-paper stroke-yellow-ink" />
          <path d="M8 1.3 A6.7 6.7 0 0 0 8 14.7 Z" className="fill-cell-yellow" />
        </>
      )}
      {kind === 'RED' && (
        <g strokeWidth="2.2" strokeLinecap="round" className="stroke-cell-red">
          <line x1="3" y1="3" x2="13" y2="13" />
          <line x1="13" y1="3" x2="3" y2="13" />
        </g>
      )}
      {kind === 'OPEN' && <circle cx="8" cy="8" r="6.75" strokeWidth="1.5" className="fill-paper stroke-ring" />}
      {kind === 'FUTURE' && <circle cx="8" cy="8" r="6.75" strokeWidth="1.2" className="fill-paper stroke-rule-2" />}
      {kind === 'PAUSED' && <line x1="4" y1="8" x2="12" y2="8" strokeWidth="1.6" strokeLinecap="round" className="stroke-faint" />}
    </svg>
  )
}

export default Mark
