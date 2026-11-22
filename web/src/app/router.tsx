import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { LoginPage } from '../features/auth/LoginPage'
import { useSession } from '../features/auth/session'
import { SignupPage } from '../features/auth/SignupPage'
import { HabitsPage } from '../features/habits/HabitsPage'
import { ProgressPage } from '../features/progress/ProgressPage'
import { TodayPage } from '../features/today/TodayPage'
import { NotFound } from './NotFound'
import { Shell } from './Shell'

/** Renders nothing during the startup session check, so a reload doesn't flash /login. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { me, checking } = useSession()
  if (checking) return null
  if (!me) return <Navigate to="/login" replace />
  return <>{children}</>
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { me, checking } = useSession()
  if (checking) return null
  if (me) return <Navigate to="/" replace />
  return <>{children}</>
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/signup" element={<GuestOnly><SignupPage /></GuestOnly>} />
      <Route element={<RequireAuth><Shell /></RequireAuth>}>
        <Route path="/" element={<TodayPage />} />
        <Route path="/habits" element={<HabitsPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default AppRouter
