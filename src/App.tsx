import { useState } from 'react'
import { useAppState } from './lib/storage'
import { BottomNav, type Tab } from './components/BottomNav'
import { Dashboard } from './pages/Dashboard'
import { Debts } from './pages/Debts'
import { Calendar } from './pages/Calendar'
import { Income } from './pages/Income'
import { Settings } from './pages/Settings'

function App() {
  const [state, setState] = useAppState()
  const [tab, setTab] = useState<Tab>('dashboard')

  return (
    <div className="mx-auto min-h-dvh max-w-md" style={{ background: 'var(--surface-page)' }}>
      <header className="sticky top-0 z-10 border-b px-4 py-3 backdrop-blur" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--surface-page) 85%, transparent)' }}>
        <h1 className="text-base font-semibold">P-Finance</h1>
      </header>

      {tab === 'dashboard' && <Dashboard state={state} setState={setState} />}
      {tab === 'debts' && <Debts state={state} setState={setState} />}
      {tab === 'calendar' && <Calendar state={state} />}
      {tab === 'income' && <Income state={state} setState={setState} />}
      {tab === 'settings' && <Settings state={state} setState={setState} />}

      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}

export default App
