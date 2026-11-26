import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AccountPage } from '../features/account/AccountPage'
import { LoginPage } from '../features/auth/LoginPage'
import { useSession } from '../features/auth/session'
import { SignupPage } from '../features/auth/SignupPage'
import { HabitsPage } from '../features/habits/HabitsPage'
import { WelcomePage } from '../features/onboarding/WelcomePage'
import { ProgressPage } from '../features/progress/ProgressPage'
import { TasksPage } from '../features/tasks/TasksPage'
import { TodayPage } from '../features/today/TodayPage'
import { NotFound } from './NotFound'
import { Shell } from './Shell'

/**
 * Renders nothing during the startup session check, so a reload doesn't flash /login. Until the intro is done,
 * the app's pages send the user to /welcome.
 */
function RequireAuth({ children, intro = false }: { children: ReactNode; intro?: boolean }) {
  const { me, checking } = useSession()
  if (checking) return null
  if (!me) return <Navigate to="/login" replace />
  if (!intro && me.onboarded === false) return <Navigate to="/welcome" replace />
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
      <Route path="/welcome" element={<RequireAuth intro><WelcomePage /></RequireAuth>} />
      <Route element={<RequireAuth><Shell /></RequireAuth>}>
        <Route path="/" element={<TodayPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/habits" element={<HabitsPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/settings" element={<AccountPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default AppRouter
