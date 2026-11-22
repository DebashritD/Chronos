import type { ReactNode } from 'react'

export type TabIcon = (props: { active: boolean; size: number }) => ReactNode

const G = 'var(--color-cell-green)'
const Y = 'var(--color-cell-yellow)'

function Svg({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

/** Progress ring with a tick; active fills the ring green. */
export const TodayIcon: TabIcon = ({ active, size }) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="8.5" opacity={active ? 0.3 : 0.35} />
    {active
      ? <path d="M12 3.5a8.5 8.5 0 0 1 7.4 12.7" stroke={G} strokeWidth={2.6} />
      : <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" />}
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </Svg>
)

/** 2×2 heatmap; active colours the cells. */
export const ProgressIcon: TabIcon = ({ active, size }) => {
  const cells: [number, number, string | undefined][] = [
    [3.5, 3.5, G], [13.5, 3.5, Y], [3.5, 13.5, G], [13.5, 13.5, undefined],
  ]
  return (
    <Svg size={size}>
      {cells.map(([x, y, c]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="7" height="7" rx="2"
          {...(active && c ? { fill: c, stroke: c } : {})} />
      ))}
    </Svg>
  )
}

/** Two habit tiles; active tints them and colours the status dots. */
export const HabitsIcon: TabIcon = ({ active, size }) => (
  <Svg size={size}>
    {[4, 14].map((y) => (
      <rect key={y} x="3" y={y} width="18" height="6" rx="3"
        {...(active ? { fill: 'currentColor', fillOpacity: 0.18 } : {})} />
    ))}
    {active ? (
      <>
        <circle cx="6.5" cy="7" r="1.4" fill={G} stroke="none" />
        <circle cx="6.5" cy="17" r="1.4" fill={Y} stroke="none" />
      </>
    ) : (
      <>
        <circle cx="6.5" cy="7" r="0.6" fill="currentColor" />
        <circle cx="6.5" cy="17" r="0.6" fill="currentColor" />
      </>
    )}
  </Svg>
)

/** Person; active is solid. */
export const AccountIcon: TabIcon = ({ active, size }) => (
  <Svg size={size}>
    <circle cx="12" cy="9" r="3.5" {...(active ? { fill: 'currentColor' } : {})} />
    <path d={active ? 'M5.5 19.5a6.5 6.5 0 0 1 13 0Z' : 'M5.5 19.5a6.5 6.5 0 0 1 13 0'}
      {...(active ? { fill: 'currentColor' } : {})} />
  </Svg>
)
