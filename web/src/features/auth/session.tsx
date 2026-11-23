/* oxlint-disable react/only-export-components -- provider and hook intentionally share a module */
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { api, clearCsrf } from '../../api/client'
import { ApiError } from '../../api/errors'
import { clearPersistedCache } from '../../api/persist'
import { setQueryErrorHandler } from '../../api/queryErrorBridge'
import type { Me } from '../../api/types'
import { clearStoredMe, readStoredMe, storeMe } from '../../lib/storedMe'
import { authRestored } from '../checkin/authGate'
import { discardCheckIns } from '../checkin/queue'

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
        if (cancelled) return
        storeMe(result)
        setMeState(result)
      })
      .catch((error: unknown) => {
        // Offline (no ApiError): carry on as the saved user. A 401 still signs out.
        if (!cancelled) setMeState(error instanceof ApiError ? null : readStoredMe())
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
        // Queries only: queued check-ins wait for the same user to sign back in.
        queryClient.getQueryCache().clear()
      }
    })
    return () => setQueryErrorHandler(null)
  }, [queryClient])

  function signedIn(result: Me): void {
    queryClient.getQueryCache().clear()
    if (readStoredMe()?.username === result.username) authRestored()
    else discardCheckIns(queryClient)
    storeMe(result)
    setMeState(result)
  }

  async function login(username: string, password: string): Promise<void> {
    signedIn(await api.post<Me>('/api/auth/login', { username, password }))
  }

  async function signup(username: string, password: string): Promise<void> {
    signedIn(await api.post<Me>('/api/auth/signup', { username, password, timezone: browserTimezone() }))
  }

  async function logout(): Promise<void> {
    try {
      await api.post('/api/auth/logout')
    } catch {
      // Sign out locally even if the request failed.
    } finally {
      clearCsrf()
      discardCheckIns(queryClient)
      queryClient.clear()
      clearStoredMe()
      void clearPersistedCache()
      setMeState(null)
      navigate('/login')
    }
  }

  function setMe(next: Me): void {
    storeMe(next)
    setMeState(next)
  }

  return (
    <SessionContext.Provider value={{ me, checking, login, signup, logout, setMe }}>
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
