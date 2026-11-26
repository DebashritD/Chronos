import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { useSession } from '../auth/session'
import { OnboardingFlow } from './OnboardingFlow'

/** /welcome: the intro until it's done, or a replay from Me with `?replay`. */
export function WelcomePage() {
  const { me } = useSession()
  const [params] = useSearchParams()
  const replay = params.has('replay')
  // Decided once: finishing the intro sets `onboarded` mid-flow, and the install screen must still show.
  const [done] = useState(() => me?.onboarded !== false && !replay)
  if (done) return <Navigate to="/" replace />
  return <OnboardingFlow replay={replay} />
}

export default WelcomePage
