import { useState } from 'react'
import { Mark } from '../../app/Mark'
import { primaryButton, StepFooter, StepHeading } from './ui'

const STEPS = {
  ios: ['Tap the Share button in Safari', 'Choose “Add to Home Screen”', 'Open No Reds from the new icon'],
  android: ['Tap ⋮ in Chrome', 'Choose “Install app”', 'Open No Reds from the new icon'],
}
type Platform = keyof typeof STEPS

const tab = (on: boolean) =>
  `min-h-11 flex-1 rounded-[8px] border-[1.5px] text-[13px] font-semibold ${on ? 'border-ink bg-ink text-paper' : 'border-rule-2 text-ink'}`

export function InstallStep({ habitName, onFinish }: { habitName: string | null; onFinish(): void }) {
  const [platform, setPlatform] = useState<Platform>(() => (/android/i.test(navigator.userAgent) ? 'android' : 'ios'))
  return (
    <>
      <p className="flex items-center gap-2.5 py-1 text-[14px] text-ink">
        <Mark kind="GREEN" size={20} />
        {habitName ? <span><b>{habitName}</b> is on your Today.</span> : <span>You’re all set.</span>}
      </p>
      <div className="mt-3.5">
        <StepHeading label="One last thing">Keep it one tap away.</StepHeading>
      </div>
      <div className="mt-5 flex gap-1.5">
        <button type="button" aria-pressed={platform === 'ios'} className={tab(platform === 'ios')} onClick={() => setPlatform('ios')}>iPhone</button>
        <button type="button" aria-pressed={platform === 'android'} className={tab(platform === 'android')} onClick={() => setPlatform('android')}>Android</button>
      </div>
      <ol className="mt-4">
        {STEPS[platform].map((step, i) => (
          <li key={step} className="flex items-center gap-3.5 border-t border-rule py-3 text-[14.5px] text-ink last:border-b">
            <span aria-hidden="true" className="w-5 font-mono text-[12px] font-medium text-accent">0{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <p className="mt-6 rounded-[10px] border border-dashed border-rule-2 px-3.5 py-3 text-[13px] leading-normal text-muted">
        After a quiet spell, the first open can take up to a minute while the server wakes. Your marks save on the phone
        and sync on their own.
      </p>
      <StepFooter><button type="button" className={primaryButton} onClick={onFinish}>Go to Today</button></StepFooter>
    </>
  )
}
