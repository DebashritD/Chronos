import { vi, type Mock } from 'vitest'

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

export function problemResponse(status: number, code: string, detail?: string): Response {
  return new Response(JSON.stringify({ code, detail }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  })
}

export interface ApiRequest {
  method: string
  url: string
  body: unknown
}

type Handler = (request: ApiRequest) => Response | undefined

/**
 * Stubs `fetch` with `handler` (unmatched requests get a 404) and sets an XSRF cookie so
 * writes don't need the `/api/auth/csrf` round trip.
 */
export function stubApi(handler: Handler): Mock {
  document.cookie = 'XSRF-TOKEN=test-token; path=/'
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined
    return handler({ method, url, body }) ?? new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** The requests a `stubApi` mock received, in order. */
export function requests(fetchMock: Mock): ApiRequest[] {
  return fetchMock.mock.calls
    .map(([input, init]) => ({
      method: (init as RequestInit | undefined)?.method ?? 'GET',
      url: String(input),
      body:
        typeof (init as RequestInit | undefined)?.body === 'string'
          ? (JSON.parse((init as RequestInit).body as string) as unknown)
          : undefined,
    }))
    .filter((r) => r.url !== '/api/auth/csrf')
}
