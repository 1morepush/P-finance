import { useEffect, useMemo, useRef, useState } from 'react'
import { applySeedUpdate, seedUpdateAvailable, skipSeedUpdate, useAppState } from './lib/storage'
import { SEED_DATE, seedState } from './data/seed'
import { formatCurrency, formatDate, totalDebt } from './lib/finance'
import { BottomNav, type Tab } from './components/BottomNav'
import { Dashboard } from './pages/Dashboard'
import { Debts } from './pages/Debts'
import { Calendar } from './pages/Calendar'
import { Income } from './pages/Income'
import { Settings } from './pages/Settings'
import {
  dedupeSettlements,
  recordSnapshot,
  settleOverduePayments,
  type AutoSettlement,
  type Dedupe,
} from './lib/payments'
import { applyUpdate, subscribeUpdate } from './lib/sw'
import { APP_VERSION, releasesSince } from './version'

function App() {
  const [state, setState, persisted] = useAppState()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [autoSettled, setAutoSettled] = useState<AutoSettlement[]>([])
  const [deduped, setDeduped] = useState<Dedupe | null>(null)
  const [updateReady, setUpdateReady] = useState(false)
  const settledOnce = useRef(false)

  const needsSeedUpdate = seedUpdateAvailable(state)

  // The banner compares this device's total with what the new figures come to
  // once their own overdue instalments are settled — the number the device will
  // actually show after loading them. Quoting the raw table made an update
  // look like $187 of new debt.
  const seedTotalAfterSettle = useMemo(
    () => totalDebt(settleOverduePayments(seedState).state.debts),
    [],
  )

  useEffect(() => subscribeUpdate(setUpdateReady), [])

  // Treat any scheduled payment whose date has passed as made. Held back while
  // newer figures are pending: settling against stale balances and due dates
  // would compound the staleness before the update could replace them.
  useEffect(() => {
    if (needsSeedUpdate || settledOnce.current) return
    settledOnce.current = true

    // Clear out instalments recorded twice before settling, so the settle that
    // follows sees one record per instalment and leaves it alone.
    const { state: clean, dedupe } = dedupeSettlements(state)
    const { state: settledState, settled } = settleOverduePayments(clean)
    const next = recordSnapshot(settledState)

    // Committed whenever anything moved, not only when something was newly
    // settled: an instalment the log already held still advances a balance and
    // a due date silently, and gating on `settled` would throw that away.
    if (next !== state) setState(next)
    if (settled.length > 0) setAutoSettled(settled)
    if (dedupe.removed > 0) setDeduped(dedupe)
    // Runs once, as soon as the figures on this device are current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSeedUpdate])

  // Today's snapshot follows the total through the day, so a payment logged
  // this afternoon is in tonight's record rather than tomorrow's.
  useEffect(() => {
    if (needsSeedUpdate || !settledOnce.current) return
    const next = recordSnapshot(state)
    if (next !== state) setState(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.debts, needsSeedUpdate])

  return (
    <div className="mx-auto min-h-dvh max-w-md" style={{ background: 'var(--surface-page)' }}>
      <header className="sticky top-0 z-10 flex items-baseline justify-between border-b px-4 py-3 backdrop-blur" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--surface-page) 85%, transparent)' }}>
        <h1 className="text-base font-semibold">P-Finance</h1>
        {/* Which build is on this phone, answerable without opening Settings —
            the question comes up every time something is deployed. */}
        <span className="tabular-nums text-xs" style={{ color: 'var(--text-muted)' }}>
          v{APP_VERSION}
        </span>
      </header>

      {updateReady && (
        <div
          className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-xl border p-3"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--cat-installment)' }}
        >
          <div className="min-w-0">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--cat-installment)' }}>
              A newer version is ready
            </h2>
            {/* Only the version being replaced can be named: the running bundle
                has no way to know the number of the one waiting to load. */}
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              This screen is still on v{APP_VERSION}. Reload to see what changed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void applyUpdate()}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium"
            style={{ background: 'var(--cat-installment)', color: 'white' }}
          >
            Reload
          </button>
        </div>
      )}

      {/*
        What the reload actually brought. Without this an update is only ever
        felt as things having silently moved; the point of numbering them is
        being able to say what arrived.
      */}
      {!updateReady && state.lastSeenVersion !== APP_VERSION && (
        <div
          className="mx-4 mt-4 rounded-xl border p-3"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--status-good)' }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--status-good)' }}>
              Updated to v{APP_VERSION}
            </h2>
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, lastSeenVersion: APP_VERSION }))}
              className="shrink-0 text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              Got it
            </button>
          </div>
          <ul className="mt-2 flex flex-col gap-1">
            {releasesSince(state.lastSeenVersion).map((r) => (
              <li key={r.version} className="flex gap-2 text-xs">
                <span className="tabular-nums shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {r.version}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>{r.headline}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!persisted && (
        <div
          className="mx-4 mt-4 rounded-xl border p-3"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--status-critical)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--status-critical)' }}>
            This browser is not saving your data
          </h2>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Writes to local storage are being refused — usually private browsing, or Safari set to
            block all cookies. The app still works, but everything you enter will be gone when you
            close it. Open it in a normal tab, or add it to your home screen.
          </p>
        </div>
      )}

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
            reconciled figures dated {formatDate(SEED_DATE)} come to{' '}
            {formatCurrency(seedTotalAfterSettle)}.
          </p>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Loading them replaces your debts, cleared log, income sources and the wage claim. Your
            bank balance, savings, logged payments and settings are kept, and any payment you
            entered by hand since {formatDate(SEED_DATE)} is re-applied to the new balances.
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

      {/* Only ever shown once per device: the duplicates are gone after this. */}
      {deduped && (
        <div
          className="mx-4 mt-4 rounded-xl border p-3"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--status-good)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--status-good)' }}>
              Cleaned up {deduped.removed} duplicate payment
              {deduped.removed === 1 ? '' : 's'}
            </h2>
            <button
              type="button"
              onClick={() => setDeduped(null)}
              className="shrink-0 text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              Dismiss
            </button>
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {deduped.names.join(', ')} had instalments recorded more than once, totalling{' '}
            {formatCurrency(deduped.amount)}. Taking a figures update reset those debts without
            clearing the history they had already produced, so the next load logged them again.
          </p>
          <p className="mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            What you owe was never wrong — only the history was, which made the progress chart and
            the payoff estimate look better than they are. Both are right now.
          </p>
        </div>
      )}

      {tab === 'dashboard' && (
        <Dashboard state={state} setState={setState} onGoToIncome={() => setTab('income')} />
      )}
      {tab === 'debts' && <Debts state={state} setState={setState} />}
      {tab === 'calendar' && <Calendar state={state} setState={setState} />}
      {tab === 'income' && <Income state={state} setState={setState} />}
      {tab === 'settings' && <Settings state={state} setState={setState} />}

      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}

export default App
