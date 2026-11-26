import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSession } from '../auth/session'
import { FirstHabitStep } from './FirstHabitStep'
import { HowStep } from './HowStep'
import { InstallStep } from './InstallStep'
import { PlaygroundStep } from './PlaygroundStep'
import { PracticeStep } from './PracticeStep'
import { WelcomeStep } from './WelcomeStep'

const COUNT = 6
const FIRST_HABIT = 4

/** The first-run intro: six screens on one sheet. Skip jumps to the first-habit screen, which has no skip. */
export function OnboardingFlow({ replay }: { replay: boolean }) {
  const { me } = useSession()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [habitName, setHabitName] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const next = () => setStep((s) => s + 1)

  useEffect(() => {
    document.documentElement.scrollTop = 0
    bodyRef.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
  }, [step])

  const screens = [
    <WelcomeStep key="welcome" username={me?.username ?? ''} onNext={next} />,
    <HowStep key="how" onNext={next} />,
    <PracticeStep key="practice" onNext={next} />,
    <PlaygroundStep key="playground" onNext={next} />,
    <FirstHabitStep key="habit" replay={replay} onDone={(name) => {
      setHabitName(name)
      next()
    }} />,
    <InstallStep key="install" habitName={habitName} onFinish={() => navigate('/', { replace: true })} />,
  ]

  return (
    <div className="flex min-h-dvh flex-col bg-paper-2 text-ink">
      <div aria-hidden="true" className="binding h-[calc(2.25rem+env(safe-area-inset-top))] md:h-14" />
      <main className="perforated sheet-edges mx-auto flex w-full max-w-md flex-1 flex-col bg-paper px-6 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:mb-10 md:flex-none md:min-h-[44rem]">
        <div className="flex h-11 items-center justify-between">
          <p className="sr-only">Step {step + 1} of {COUNT}</p>
          <div aria-hidden="true" className="flex gap-1.5">
            {Array.from({ length: COUNT }, (_, i) => (
              <i key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-[18px] bg-ink' : 'w-1.5 bg-rule-2'}`} />
            ))}
          </div>
          {step < FIRST_HABIT && (
            <button type="button" onClick={() => setStep(FIRST_HABIT)} className="min-h-11 text-[14px] font-semibold text-muted">Skip</button>
          )}
        </div>
        <div ref={bodyRef} className="mt-2 flex flex-1 flex-col">{screens[step]}</div>
      </main>
    </div>
  )
}
