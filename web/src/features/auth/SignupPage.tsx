import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { messageFor } from '../../api/errors'
import { inputClass, primaryButton } from '../../lib/ui'
import { AuthLayout } from './AuthLayout'
import { browserTimezone, useSession } from './session'

export function SignupPage() {
  const { signup } = useSession()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signup(username, password)
      navigate('/')
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Sign up">
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-2.5">
        <label htmlFor="username" className="sr-only">Username</label>
        <input id="username" autoComplete="username" placeholder="Username" value={username} minLength={3}
          maxLength={32} onChange={(e) => setUsername(e.target.value)} className={inputClass} />
        <span className="px-1 text-xs text-dim">3–32 letters, digits, “_”, “.” or “-”</span>
        <label htmlFor="password" className="sr-only">Password</label>
        <input id="password" type="password" autoComplete="new-password" placeholder="Password" value={password}
          minLength={8} maxLength={72} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        <span className="px-1 text-xs text-dim">At least 8 characters</span>
        <p className="px-1 text-xs text-muted">Timezone: {browserTimezone()} (change it later in Account)</p>
        {error && <p role="alert" className="text-sm text-cell-red">{error}</p>}
        <button type="submit" disabled={submitting} className={`${primaryButton} mt-2 w-full`}>Sign up</button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        Have an account? <Link to="/login" className="font-semibold text-accent">Log in</Link>
      </p>
    </AuthLayout>
  )
}

export default SignupPage
