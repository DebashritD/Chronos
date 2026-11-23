/** Check-ins that hit a 401 wait here until the same user signs back in (or the queue is discarded). */
export class AuthDiscardedError extends Error {
  constructor() {
    super('Signed in as someone else; queued marks were discarded')
    this.name = 'AuthDiscardedError'
  }
}

let gate: { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void } | null = null

export function waitForAuth(): Promise<void> {
  if (!gate) {
    let resolve!: () => void
    let reject!: (error: Error) => void
    const promise = new Promise<void>((res, rej) => {
      resolve = res
      reject = rej
    })
    gate = { promise, resolve, reject }
  }
  return gate.promise
}

export function authRestored(): void {
  gate?.resolve()
  gate = null
}

export function authDiscarded(): void {
  gate?.reject(new AuthDiscardedError())
  gate = null
}
