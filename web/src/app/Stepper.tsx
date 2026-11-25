const stepButton = 'flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-rule-2 text-[22px] leading-none text-ink aria-disabled:opacity-30'

/** − value + for a small whole number; the value is announced as it changes. At a limit the button stays focusable (aria-disabled) so focus isn't lost. */
export function Stepper({ value, min, max, labelledBy, onChange }: {
  value: number; min: number; max: number; labelledBy: string; onChange(next: number): void
}) {
  return (
    <div className="flex items-center gap-5">
      <button type="button" aria-label="Fewer" aria-disabled={value <= min} onClick={() => value > min && onChange(value - 1)} className={stepButton}>−</button>
      <output aria-live="polite" aria-labelledby={labelledBy} className="w-12 text-center font-display text-[40px] leading-none font-bold text-ink">
        {value}
      </output>
      <button type="button" aria-label="More" aria-disabled={value >= max} onClick={() => value < max && onChange(value + 1)} className={stepButton}>+</button>
    </div>
  )
}

export default Stepper
