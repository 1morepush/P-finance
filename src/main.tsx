import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { markUpdateReady, rememberRegistration } from './lib/sw'

/**
 * How often to ask the server whether a newer build exists, while the app is
 * open and on screen. Cheap — a conditional request for one small file — and
 * it is the only thing standing between a fix being deployed and it arriving.
 */
const UPDATE_CHECK_MS = 60_000

registerSW({
  immediate: true,
  // `registerType: 'autoUpdate'` never calls onNeedRefresh — under that mode
  // the plugin fires `onNeedReload` once the new worker has activated, and
  // reloads the page itself if nothing handles it. Handling it means the app
  // can offer the reload instead of yanking the page away mid-entry.
  onNeedReload() {
    markUpdateReady(async () => {
      location.reload()
    })
  },
  // The browser only looks for a new worker when the page is navigated to. A
  // home-screen app resumed from the switcher is not a navigation, so without
  // this it can sit on a months-old build forever. Check on an interval, and
  // again the moment it comes back to the foreground.
  onRegisteredSW(_url, registration) {
    if (!registration) return
    rememberRegistration(registration)

    const check = () => {
      if (document.visibilityState === 'visible') void registration.update()
    }

    setInterval(check, UPDATE_CHECK_MS)
    document.addEventListener('visibilitychange', check)
    check()
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
