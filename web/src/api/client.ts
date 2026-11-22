import { ApiError } from './errors'
import { trackPending } from './pending'

const CSRF_COOKIE = 'XSRF-TOKEN'
const CSRF_HEADER = 'X-XSRF-TOKEN'

function readCookie(name: string): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

// In-flight CSRF-priming fetch, so concurrent requests share one round trip.
let csrfPromise: Promise<void> | null = null

/** Forgets any cached/in-flight CSRF state (e.g. after logout). */
export function clearCsrf(): void {
  csrfPromise = null
}

async function ensureCsrfCookie(): Promise<void> {
  if (readCookie(CSRF_COOKIE)) {
    return
  }
  if (!csrfPromise) {
    csrfPromise = fetch('/api/auth/csrf', { credentials: 'same-origin' })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to prime CSRF cookie: ${res.status}`)
        }
      })
      .finally(() => {
        // Only dedupe concurrent in-flight requests; once settled, forget
        // it so a later call (e.g. the cookie has since expired/vanished)
        // primes again rather than trusting a stale resolved promise.
        csrfPromise = null
      })
  }
  await csrfPromise
}

function buildQuery(params?: Record<string, string | number | undefined>): string {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.append(key, String(value))
    }
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

async function parseErrorBody(res: Response): Promise<{ code: string | null; detail: string | null }> {
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/problem+json')) {
    const body = (await res.json()) as { code?: string; detail?: string }
    return { code: body.code ?? null, detail: body.detail ?? null }
  }
  return { code: null, detail: null }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options: { params?: Record<string, string | number | undefined>; body?: unknown } = {},
): Promise<T> {
  const url = method === 'GET' ? `${path}${buildQuery(options.params)}` : path

  const headers: Record<string, string> = {}
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const doFetch = async () => {
    if (method !== 'GET') {
      await ensureCsrfCookie()
      const token = readCookie(CSRF_COOKIE)
      if (token) {
        headers[CSRF_HEADER] = token
      }
    }

    const res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })

    if (!res.ok) {
      const { code, detail } = await parseErrorBody(res)
      throw new ApiError(res.status, code, detail)
    }

    if (res.status === 204) {
      return undefined as T
    }

    const text = await res.text()
    if (!text) {
      return undefined as T
    }

    return JSON.parse(text) as T
  }

  return trackPending(doFetch())
}

export const api = {
  get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    return request<T>('GET', path, { params })
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('POST', path, { body })
  },
  put<T>(path: string, body: unknown): Promise<T> {
    return request<T>('PUT', path, { body })
  },
  del(path: string): Promise<void> {
    return request<void>('DELETE', path)
  },
}
