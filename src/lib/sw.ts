/**
 * A hand-off between the service worker registration, which happens once in
 * main.tsx before React exists, and the App, which wants to show a banner.
 *
 * The worker installs new builds on its own, but the page keeps running the
 * old one until it reloads — so a fix could be live for days while the phone
 * showed the bug. Now the page is told, and offers the reload.
 */
type Listener = (ready: boolean) => void

let ready = false
let reload: (() => Promise<void>) | null = null
const listeners = new Set<Listener>()

export function markUpdateReady(apply: () => Promise<void>) {
  ready = true
  reload = apply
  for (const l of listeners) l(true)
}

export function subscribeUpdate(l: Listener): () => void {
  listeners.add(l)
  l(ready)
  return () => {
    listeners.delete(l)
  }
}

export async function applyUpdate() {
  if (reload) await reload()
  else location.reload()
}

/** Set once the worker registers, so the app can check on demand. */
let registration: ServiceWorkerRegistration | null = null

export function rememberRegistration(r: ServiceWorkerRegistration) {
  registration = r
}

/**
 * Asks the server whether a newer build exists, right now.
 *
 * The automatic checks cover the ordinary case, but when someone is standing
 * there waiting for a change to arrive, "it will turn up within the minute" is
 * not an answer.
 */
export async function checkForUpdate(): Promise<'asked' | 'no-worker' | 'failed'> {
  if (!registration) return 'no-worker'
  try {
    // Offline, or a server that will not answer, rejects here. Without the
    // catch the button sits on "Checking…" for good, which reads as a hang.
    await registration.update()
    return 'asked'
  } catch {
    return 'failed'
  }
}
