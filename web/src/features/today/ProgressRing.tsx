/** "N/M DONE" ring; r = 15.9155 makes the circumference 100. */
export function ProgressRing({ done, total }: { done: number; total: number }) {
  const share = total === 0 ? 0 : (done * 100) / total
  return (
    <div role="img" aria-label={`${done} of ${total} done`} className="relative h-24 w-24 flex-none">
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--color-surface)" strokeWidth="3.2" />
        {share > 0 && (
          <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--color-cell-green)" strokeWidth="3.2"
            strokeLinecap="round" strokeDasharray={`${share} 100`}
            className="transition-[stroke-dasharray] duration-500" />
        )}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="font-display text-[22px] leading-none font-extrabold text-fg">{done}/{total}</span>
        <span className="mt-1 text-[10px] font-semibold tracking-wider text-muted">DONE</span>
      </span>
    </div>
  )
}

export default ProgressRing
