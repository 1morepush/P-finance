import { useEffect, useRef, useState } from 'react'
import { applySeedUpdate, seedUpdateAvailable, skipSeedUpdate, useAppState } from './lib/storage'
import { SEED_VERSION } from './data/seed'
import { totalDebt } from './lib/finance'
import { seedState } from './data/seed'
import { BottomNav, type Tab } from './components/BottomNav'
import { Dashboard } from './pages/Dashboard'
import { Debts } from './pages/Debts'
import { Calendar } from './pages/Calendar'
import { Income } from './pages/Income'
import { Settings } from './pages/Settings'
import { settleOverduePayments, type AutoSettlement } from './lib/payments'
import { formatCurrency, formatDate } from './lib/finance'


function App() {
  const [state, setState] = useAppState()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [autoSettled, setAutoSettled] = useState<AutoSettlement[]>([])
  const settledOnce = useRef(false)

  const needsSeedUpdate = seedUpdateAvailable(state)

  // Treat any scheduled payment whose date has passed as made. Held back while
  // newer figures are pending: settling against stale balances and due dates
  // would compound the staleness before the update could replace them.
  useEffect(() => {
    if (needsSeedUpdate || settledOnce.current) return
    settledOnce.current = true
    const { state: next, settled } = settleOverduePayments(state)
    if (settled.length > 0) {
      setState(next)
      setAutoSettled(settled)
    }
    // Runs once, as soon as the figures on this device are current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSeedUpdate])

  return (
    <div className="mx-auto min-h-dvh max-w-md" style={{ background: 'var(--surface-page)' }}>
      <header className="sticky top-0 z-10 border-b px-4 py-3 backdrop-blur" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--surface-page) 85%, transparent)' }}>
        <h1 className="text-base font-semibold">P-Finance</h1>
      </header>

      {needsSeedUpdate && (
        <div
          className="mx-4 mt-4 rounded-xl border p-3"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--cat-installment)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--cat-installment)' }}>
            Updated figures available
          </h2>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            This device is showing {formatCurrency(totalDebt(state.debts))} of active debt. The
            reconciled figures dated {formatDate(SEED_VERSION)} total{' '}
            {formatCurrency(totalDebt(seedState.debts))}.
          </p>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Loading them replaces your debts, cleared log, income sources and the wage claim. Your
            bank balance, savings, logged payments and settings are kept.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setState((s) => applySeedUpdate(s))}
              className="flex-1 rounded-lg py-2 text-xs font-medium"
              style={{ background: 'var(--cat-installment)', color: 'white' }}
            >
              Load new figures
            </button>
            <button
              type="button"
              onClick={() => setState((s) => skipSeedUpdate(s))}
              className="flex-1 rounded-lg py-2 text-xs font-medium"
              style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}
            >
              Keep mine
            </button>
          </div>
        </div>
      )}

      {autoSettled.length > 0 && (
        <div
          className="mx-4 mt-4 rounded-xl border p-3"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--status-warning)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--status-warning)' }}>
              Marked as paid — due dates passed
            </h2>
            <button
              type="button"
              onClick={() => setAutoSettled([])}
              className="shrink-0 text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              Dismiss
            </button>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {autoSettled.map((a) => (
              <div key={a.debtId} className="flex items-baseline justify-between gap-3 text-xs">
                <span>
                  {a.debtName}
                  <span style={{ color: 'var(--text-muted)' }}>
                    {' '}
                    · {a.count} payment{a.count === 1 ? '' : 's'}
                    {a.cleared && ' · cleared 🎉'}
                  </span>
                </span>
                <span className="tabular-nums shrink-0">{formatCurrency(a.total)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Your bank balance was left alone, since you enter that from the real account. Anything
            that did not actually go through can be undone under Logged payments.
          </p>
        </div>
      )}

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
