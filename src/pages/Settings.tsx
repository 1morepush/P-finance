import { useMemo, useRef, useState } from 'react'
import type { AppState, DebtStrategy } from '../types'
import { Card } from '../components/Card'
import { formatCurrency, formatDate } from '../lib/finance'
import { compareStrategies, STRATEGY_LABEL } from '../lib/strategy'
import { daysUntil, today } from '../lib/schedule'
import { describeImport, exportStateAsJson, markBackedUp, resetToSeed } from '../lib/storage'
import { copyText, deliverFile } from '../lib/share'
import { checkForUpdate } from '../lib/sw'
import { SEED_VERSION } from '../data/seed'

export function Settings({
  state,
  setState,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [extra, setExtra] = useState('100')
  const [backupNote, setBackupNote] = useState<string | null>(null)
  const [updateNote, setUpdateNote] = useState<string | null>(null)

  const extraPerMonth = Number(extra) || 0
  const comparison = useMemo(() => compareStrategies(state, extraPerMonth), [state, extraPerMonth])

  const backupAge = state.lastBackupAt ? -daysUntil(state.lastBackupAt) : null
  const backupStale = backupAge === null || backupAge > 30

  function setStrategy(strategy: DebtStrategy) {
    setState((s) => ({ ...s, settings: { ...s.settings, strategy } }))
  }

  // The two reserved shares come out of the same leftover, so raising one past
  // the remaining headroom pushes the other down rather than starving debt payoff.
  function setSavingsPercent(percent: number) {
    setState((s) => ({
      ...s,
      settings: {
        ...s.settings,
        savingsPercent: percent,
        keepInCheckingPercent: Math.min(s.settings.keepInCheckingPercent, 100 - percent),
      },
    }))
  }

  function setKeepInCheckingPercent(percent: number) {
    setState((s) => ({
      ...s,
      settings: {
        ...s.settings,
        keepInCheckingPercent: percent,
        savingsPercent: Math.min(s.settings.savingsPercent, 100 - percent),
      },
    }))
  }

  // The share sheet is the route that actually works in the iOS home-screen
  // app; a bare download link there often does nothing. Only a delivery that
  // happened counts as a backup.
  async function downloadBackup() {
    const how = await deliverFile(`p-finance-backup-${today()}.json`, exportStateAsJson(state), 'application/json')
    if (how === 'cancelled') return
    setState(markBackedUp)
    setBackupNote(how === 'shared' ? 'Sent to the share sheet.' : 'Downloaded.')
  }

  async function copyBackup() {
    const ok = await copyText(exportStateAsJson(state))
    if (ok) setState(markBackedUp)
    setBackupNote(ok ? 'Copied — paste it into a note or a message to yourself.' : 'The browser refused the copy.')
  }

  function importBackup(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const incoming = describeImport(String(reader.result))
        // Replacing everything on the device deserves one question, with the
        // shape of what is coming in and what it displaces.
        const ok = confirm(
          `Replace everything on this device with this backup?\n\n` +
            `Incoming: ${incoming.debts} debts, ${incoming.payments} logged payments, ${incoming.shifts} shifts` +
            `${incoming.seedVersion ? ` (figures ${incoming.seedVersion})` : ''}.\n` +
            `Here now: ${state.debts.length} debts, ${state.payments.length} payments, ${state.shifts.length} shifts.`,
        )
        if (ok) setState(incoming.state)
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Could not import that file.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <h1 className="text-lg font-semibold">Settings</h1>

      <Card>
        <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Debt payoff strategy
        </h2>
        <div className="flex gap-2">
          {(['tier', 'avalanche', 'snowball'] as DebtStrategy[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStrategy(s)}
              className="flex-1 rounded-lg py-2 text-sm font-medium capitalize"
              style={{
                background: state.settings.strategy === s ? 'var(--cat-installment)' : 'var(--surface-page)',
                color: state.settings.strategy === s ? 'white' : 'var(--text-secondary)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          Tier follows your own priority ordering: urgent first, then ~36% APR plans, 0% promo
          BNPL, the Apple Card, then flexible personal debts. Avalanche targets the highest APR
          first (pure interest savings). Snowball targets the smallest balance first (faster wins).
        </p>
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          What each one costs
        </h2>
        <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Run forward from today's balances, paying every minimum plus this much extra each month.
          A 0% plan costs nothing to carry, so finishing one early saves nothing — only the Apple
          Card's interest actually responds to where the extra goes.
        </p>

        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Extra per month ($)
          <input
            type="number"
            inputMode="decimal"
            step="10"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            className="w-24 rounded-lg border px-2 py-1 text-sm"
            style={{
              background: 'var(--surface-page)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </label>

        <div className="mt-3 flex flex-col gap-1">
          {comparison.results.map((r) => {
            const isCurrent = r.strategy === state.settings.strategy
            const isBest = r.strategy === comparison.best.strategy
            const diff = r.totalPaid - comparison.best.totalPaid
            return (
              <div
                key={r.strategy}
                className="flex items-baseline justify-between gap-2 rounded-lg px-2 py-2 text-sm"
                style={{ background: isCurrent ? 'var(--surface-page)' : 'transparent' }}
              >
                <span className="min-w-0">
                  <span className="font-medium">{STRATEGY_LABEL[r.strategy]}</span>
                  {isCurrent && (
                    <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      current
                    </span>
                  )}
                  {isBest && (
                    <span className="ml-1 text-xs font-medium" style={{ color: 'var(--status-good)' }}>
                      cheapest
                    </span>
                  )}
                  <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                    {Number.isFinite(r.months) ? `${r.months} months` : 'never clears'}
                    {!r.clearsEverything && Number.isFinite(r.leftStanding) && (
                      <span style={{ color: 'var(--status-warning)' }}>
                        {' '}
                        · leaves {formatCurrency(r.leftStanding)} untouched
                      </span>
                    )}
                    {r.firstTarget ? ` · extra goes to ${r.firstTarget}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tabular-nums font-semibold">
                    {Number.isFinite(r.interest) ? formatCurrency(r.interest) : '—'}
                  </span>
                  <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                    interest
                    {diff > 0.5 && (
                      <span style={{ color: 'var(--status-warning)' }}>
                        {' '}
                        +{formatCurrency(diff)}
                      </span>
                    )}
                  </span>
                </span>
              </div>
            )
          })}
        </div>

        {comparison.costOfCurrent > 0.5 ? (
          <p
            className="mt-3 rounded-lg p-2 text-xs"
            style={{ background: 'var(--surface-page)', color: 'var(--status-warning)' }}
          >
            Staying on {STRATEGY_LABEL[comparison.current.strategy]} costs about{' '}
            <strong>{formatCurrency(comparison.costOfCurrent)}</strong> more than{' '}
            {STRATEGY_LABEL[comparison.best.strategy]} at this rate
            {comparison.monthsLost > 0 && <> and takes {comparison.monthsLost} months longer</>}.
          </p>
        ) : (
          <p
            className="mt-3 rounded-lg p-2 text-xs"
            style={{ background: 'var(--surface-page)', color: 'var(--status-good)' }}
          >
            {STRATEGY_LABEL[comparison.current.strategy]} is as cheap as any of the three at this
            rate — the orderings only diverge once the extra outpaces your 0% plans, which finish
            on their own minimums.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Savings rate
        </h2>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={50}
            value={state.settings.savingsPercent}
            onChange={(e) => setSavingsPercent(Number(e.target.value))}
            className="w-full"
          />
          <span className="tabular-nums w-12 text-right text-sm font-semibold">
            {state.settings.savingsPercent}%
          </span>
        </div>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          Share of each check left over after minimum debt payments that gets moved into savings.
        </p>

        <h2 className="mt-4 mb-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Keep in checking
        </h2>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100 - state.settings.savingsPercent}
            value={state.settings.keepInCheckingPercent}
            onChange={(e) => setKeepInCheckingPercent(Number(e.target.value))}
            className="w-full"
          />
          <span className="tabular-nums w-12 text-right text-sm font-semibold">
            {state.settings.keepInCheckingPercent}%
          </span>
        </div>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          Share deliberately left in your checking account to build a cushion. It needs no action —
          the money simply stays put.
        </p>

        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          These two only differ if the savings share actually leaves your checking account. Tapping
          "Move to savings" on Home moves it in the app; do the transfer in your bank too, or the
          two are the same pile of money counted twice.
        </p>

        <p
          className="mt-3 rounded-lg p-2 text-xs"
          style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}
        >
          Remaining{' '}
          <strong style={{ color: 'var(--text-primary)' }}>
            {100 - state.settings.savingsPercent - state.settings.keepInCheckingPercent}%
          </strong>{' '}
          goes to extra debt payoff.
        </p>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Backup &amp; restore
        </h2>
        <p
          className="mb-2 text-xs font-medium"
          style={{ color: backupStale ? 'var(--status-warning)' : 'var(--status-good)' }}
        >
          {backupAge === null
            ? '⚠ Never backed up on this device.'
            : backupAge === 0
              ? '✓ Backed up today.'
              : `${backupStale ? '⚠' : '✓'} Last backup ${backupAge} day${backupAge === 1 ? '' : 's'} ago (${formatDate(state.lastBackupAt!)}).`}
        </p>
        <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Everything is stored only on this device, and a browser can clear it without warning. The
          debt figures can be re-seeded; your {state.payments.length} logged payment
          {state.payments.length === 1 ? '' : 's'} and {state.shifts.length} shift
          {state.shifts.length === 1 ? '' : 's'} cannot.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void downloadBackup()}
            className="flex-1 rounded-lg py-2 text-sm font-medium"
            style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}
          >
            Export backup
          </button>
          <button
            type="button"
            onClick={() => void copyBackup()}
            className="flex-1 rounded-lg py-2 text-sm font-medium"
            style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}
          >
            Copy as text
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-1 rounded-lg py-2 text-sm font-medium"
            style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}
          >
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importBackup(file)
              e.target.value = ''
            }}
          />
        </div>
        {backupNote && (
          <p className="mt-2 text-xs" style={{ color: 'var(--status-good)' }}>
            ✓ {backupNote}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirm('Discard everything on this device and restore the source-of-truth figures?')) {
              setState(resetToSeed())
            }
          }}
          className="mt-3 w-full rounded-lg py-2 text-sm font-medium"
          style={{ background: 'transparent', color: 'var(--status-critical)' }}
        >
          Reset to source-of-truth data
        </button>
      </Card>

      {/*
        Without this, "did the update arrive?" can only be answered by looking
        for a change and not finding one — which is also what a broken update
        looks like. The stamp says which build is running; the button asks the
        server for a newer one rather than waiting on the next check.
      */}
      <Card>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          App version
        </h2>
        <p className="tabular-nums mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Built {__BUILD_STAMP__}
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {/* Printed raw: versions carry suffixes like "2026-09-14c", which is
              not a date and must not be run through a date formatter. */}
          Figures on this device: {state.seedVersion}
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Newest available: {SEED_VERSION}
        </p>
        <button
          type="button"
          onClick={async () => {
            setUpdateNote('Checking…')
            const result = await checkForUpdate()
            setUpdateNote(
              {
                asked: 'Asked for the newest build. If one exists, a reload banner appears at the top.',
                'no-worker': 'No service worker here — pull down to refresh the page instead.',
                failed: 'Could not reach the server. Try again when you have a connection.',
              }[result],
            )
          }}
          className="mt-3 w-full rounded-lg py-2 text-sm font-medium"
          style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}
        >
          Check for a new version
        </button>
        {updateNote && (
          <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {updateNote}
          </p>
        )}
      </Card>
    </div>
  )
}
