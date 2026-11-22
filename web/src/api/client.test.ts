import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, clearCsrf } from './client'
import { ApiError } from './errors'
import { subscribePending } from './pending'

function clearCookies() {
  for (const cookie of document.cookie.split('; ')) {
    const name = cookie.split('=')[0]
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    }
  }
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

function problemResponse(status: number, code: string | null, detail: string | null) {
  return new Response(JSON.stringify({ code, detail }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  })
}

describe('api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearCookies()
    clearCsrf()
  })

  it('GET adds query params in order and skips undefined', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))

    await api.get('/api/movies', { q: 'dune', page: 0, size: undefined })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/movies?q=dune&page=0')
  })

  it('POST without a CSRF cookie fetches /api/auth/csrf first then sends the header', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementationOnce(async (url) => {
      expect(url).toBe('/api/auth/csrf')
      document.cookie = 'XSRF-TOKEN=abc123; path=/'
      return jsonResponse({})
    })
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1 }))

    await api.post('/api/watched', { tmdbId: 1 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, firstInit] = fetchMock.mock.calls[0]
    expect(firstInit?.method ?? 'GET').toBe('GET')
    const [secondUrl, secondInit] = fetchMock.mock.calls[1]
    expect(secondUrl).toBe('/api/watched')
    expect(secondInit?.headers).toMatchObject({ 'X-XSRF-TOKEN': 'abc123' })
  })

  it('POST with a CSRF cookie already present does not refetch CSRF', async () => {
    document.cookie = 'XSRF-TOKEN=existing; path=/'
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 2 }))

    await api.post('/api/watched', { tmdbId: 2 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/watched')
    expect(init?.headers).toMatchObject({ 'X-XSRF-TOKEN': 'existing' })
  })

  it('primes CSRF again if the cookie disappears after an earlier successful priming', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementationOnce(async (url) => {
      expect(url).toBe('/api/auth/csrf')
      document.cookie = 'XSRF-TOKEN=first; path=/'
      return jsonResponse({})
    })
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1 }))

    await api.post('/api/watched', { tmdbId: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    clearCookies()

    fetchMock.mockImplementationOnce(async (url) => {
      expect(url).toBe('/api/auth/csrf')
      document.cookie = 'XSRF-TOKEN=second; path=/'
      return jsonResponse({})
    })
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 2 }))

    await api.post('/api/watched', { tmdbId: 2 })

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls[2][0]).toBe('/api/auth/csrf')
  })

  it('rejects when the CSRF priming response is not ok', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }))

    await expect(api.post('/api/watched', { tmdbId: 1 })).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('204 responses resolve to undefined', async () => {
    document.cookie = 'XSRF-TOKEN=existing; path=/'
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(api.del('/api/watched/1')).resolves.toBeUndefined()
  })

  it('200 responses with an empty body (e.g. logout) resolve to undefined', async () => {
    document.cookie = 'XSRF-TOKEN=existing; path=/'
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }))

    await expect(api.post('/api/auth/logout')).resolves.toBeUndefined()
  })

  it('problem JSON responses throw an ApiError with code and detail', async () => {
    document.cookie = 'XSRF-TOKEN=existing; path=/'
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      problemResponse(409, 'ALREADY_WATCHED', 'This movie is already in your watched list'),
    )

    await expect(api.post('/api/watched', { tmdbId: 1 })).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_WATCHED',
      detail: 'This movie is already in your watched list',
    })
  })

  it('non-JSON error responses throw an ApiError with null code/detail', async () => {
    document.cookie = 'XSRF-TOKEN=existing; path=/'
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }))

    const error = await api.post('/api/watched', { tmdbId: 1 }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(500)
    expect((error as ApiError).code).toBeNull()
    expect((error as ApiError).detail).toBeNull()
  })

  it('counts pending while the CSRF-priming fetch is in flight (cold-start case)', async () => {
    const fetchMock = vi.mocked(fetch)
    let resolveCsrf: (value: Response) => void = () => {}
    fetchMock.mockImplementationOnce(async (url) => {
      expect(url).toBe('/api/auth/csrf')
      return new Promise((resolve) => {
        resolveCsrf = resolve
      })
    })
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1 }))

    const counts: number[] = []
    const unsubscribe = subscribePending((count) => counts.push(count))

    const pending = api.post('/api/watched', { tmdbId: 1 })
    await Promise.resolve()
    await Promise.resolve()
    expect(counts).toEqual([1])

    document.cookie = 'XSRF-TOKEN=abc123; path=/'
    resolveCsrf(jsonResponse({}))
    await pending

    expect(counts).toEqual([1, 0])
    unsubscribe()
  })

  it('tracks pending count rising and falling across a request', async () => {
    document.cookie = 'XSRF-TOKEN=existing; path=/'
    const fetchMock = vi.mocked(fetch)
    let resolveFetch: (value: Response) => void = () => {}
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
    )

    const counts: number[] = []
    const unsubscribe = subscribePending((count) => counts.push(count))

    const pending = api.post('/api/watched', { tmdbId: 1 })
    await Promise.resolve()
    await Promise.resolve()
    expect(counts).toEqual([1])

    resolveFetch(jsonResponse({ id: 1 }))
    await pending

    expect(counts).toEqual([1, 0])
    unsubscribe()
  })
})
