import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { markUpdateReady } from './lib/sw'

const updateSW = registerSW({
  immediate: true,
  // A new build is installed and waiting. The page keeps running the old one
  // until it reloads, so tell the App rather than leave the fix sitting there.
  onNeedRefresh() {
    markUpdateReady(() => updateSW(true))
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
