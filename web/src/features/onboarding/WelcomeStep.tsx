import { Mark } from '../../app/Mark'
import { lede, primaryButton, StepFooter, StepHeading } from './ui'

const LEGEND = [
  { kind: 'GREEN', label: 'Target', text: 'You did the whole thing.' },
  { kind: 'YELLOW', label: 'Minimum', text: 'You did the smallest version. It still counts.' },
  { kind: 'RED', label: 'Missed', text: 'You skipped it. This is the one to avoid.' },
] as const

export function WelcomeStep({ username, onNext }: { username: string; onNext(): void }) {
  return (
    <>
      <StepHeading label={`Welcome, ${username}`}>Aim for no reds, not perfect days.</StepHeading>
      <p className={lede}>Every time a habit is due, you give it one of three marks. A busy day can still count.</p>
      <ul className="mt-6">
        {LEGEND.map(({ kind, label, text }) => (
          <li key={kind} className="flex items-start gap-3.5 border-t border-rule py-3.5 last:border-b">
            <Mark kind={kind} size={26} />
            <p>
              <b className="block font-display text-[19px] font-semibold text-ink">{label}</b>
              <span className="text-[13.5px] text-muted">{text}</span>
            </p>
          </li>
        ))}
      </ul>
      <StepFooter><button type="button" className={primaryButton} onClick={onNext}>Show me how</button></StepFooter>
    </>
  )
}
