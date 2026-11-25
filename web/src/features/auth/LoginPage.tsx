import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { messageFor } from '../../api/errors'
import { inkButton, underlineInput } from '../../lib/ui'
import { AuthLayout } from './AuthLayout'
import { useSession } from './session'

export function LoginPage() {
  const { login } = useSession()
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
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Log in">
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-2.5">
        <label htmlFor="username" className="sr-only">Username</label>
        <input id="username" autoComplete="username" placeholder="Username" value={username}
          onChange={(e) => setUsername(e.target.value)} className={underlineInput} />
        <label htmlFor="password" className="sr-only">Password</label>
        <input id="password" type="password" autoComplete="current-password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} className={underlineInput} />
        {error && <p role="alert" className="text-sm text-cell-red">{error}</p>}
        <button type="submit" disabled={submitting} className={`${inkButton} mt-2 w-full`}>Log in</button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        New here? <Link to="/signup" className="font-semibold text-accent underline underline-offset-4">Create an account</Link>
      </p>
    </AuthLayout>
  )
}

export default LoginPage
