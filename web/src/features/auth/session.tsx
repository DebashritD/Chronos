/* oxlint-disable react/only-export-components -- provider and hook intentionally share a module */
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { api, clearCsrf } from '../../api/client'
import { ApiError } from '../../api/errors'
import { setQueryErrorHandler } from '../../api/queryErrorBridge'
import type { Me } from '../../api/types'

interface SessionValue {
  me: Me | null
  /** True while the startup `/api/auth/me` check is in flight. */
  checking: boolean
  login(username: string, password: string): Promise<void>
  signup(username: string, password: string): Promise<void>
  logout(): Promise<void>
  setMe(me: Me): void
}

const SessionContext = createContext<SessionValue | null>(null)

export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Signed-in user state. Checks `/api/auth/me` on mount unless `initialMe` is given (tests).
 * Any query that fails with 401 signs the user out locally (the route guard then shows /login).
 */
export function SessionProvider({ children, initialMe }: { children: ReactNode; initialMe?: Me | null }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [me, setMeState] = useState<Me | null>(initialMe ?? null)
  const [checking, setChecking] = useState(initialMe === undefined)

  useEffect(() => {
    if (initialMe !== undefined) {
      return
    }
    let cancelled = false
    api
      .get<Me>('/api/auth/me')
      .then((result) => {
        if (!cancelled) setMeState(result)
      })
      .catch(() => {
        if (!cancelled) setMeState(null)
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [initialMe])

  useEffect(() => {
    setQueryErrorHandler((err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        setMeState(null)
        queryClient.clear()
      }
    })
    return () => setQueryErrorHandler(null)
  }, [queryClient])

  async function login(username: string, password: string): Promise<void> {
    const result = await api.post<Me>('/api/auth/login', { username, password })
    queryClient.clear()
    setMeState(result)
  }

  async function signup(username: string, password: string): Promise<void> {
    const result = await api.post<Me>('/api/auth/signup', { username, password, timezone: browserTimezone() })
    queryClient.clear()
    setMeState(result)
  }

  async function logout(): Promise<void> {
    try {
      await api.post('/api/auth/logout')
    } catch {
      // Sign out locally even if the request failed.
    } finally {
      clearCsrf()
      queryClient.clear()
      setMeState(null)
      navigate('/login')
    }
  }

  return (
    <SessionContext.Provider value={{ me, checking, login, signup, logout, setMe: setMeState }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return ctx
}
