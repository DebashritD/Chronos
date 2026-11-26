import { explainBox, fieldLabel, primaryButton, StepFooter, StepHeading } from './ui'

const FIELDS = [
  { label: 'Name', value: 'Read' },
  { label: 'Minimum', value: '5 pages', why: 'The smallest version you’d still do on your worst day.' },
  { label: 'Target', value: '20 pages', why: 'What a good day looks like.' },
]

export function HowStep({ onNext }: { onNext(): void }) {
  return (
    <>
      <StepHeading label="How a habit works" small>Every habit has two levels.</StepHeading>
      <p className="mt-2 text-[14px] leading-normal text-muted">
        When you add a habit, you write down a small version and a full version. Here’s Read:
      </p>
      <dl>
        {FIELDS.map(({ label, value, why }) => (
          <div key={label} className="mt-3 flex flex-col gap-1">
            <dt className={fieldLabel}>{label}</dt>
            <dd className="border-b border-rule-2 pt-1 pb-1.5 text-[16px] text-ink">{value}</dd>
            {why && <dd className="text-[12.5px] font-medium text-accent">{why}</dd>}
          </div>
        ))}
      </dl>
      <p className={explainBox}>
        <b>Why this works.</b> Most streaks don’t end on lazy days. They end on busy ones, when the full habit feels
        impossible and you skip it. A Minimum small enough for your worst day keeps the chain alive, and Target keeps
        good days ambitious. Showing up a little beats not showing up.
      </p>
      <StepFooter><button type="button" className={primaryButton} onClick={onNext}>Next</button></StepFooter>
    </>
  )
}
