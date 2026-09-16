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
