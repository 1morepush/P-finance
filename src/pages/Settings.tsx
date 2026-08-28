import { useRef } from 'react'
import type { AppState, DebtStrategy } from '../types'
import { Card } from '../components/Card'
import { exportStateAsJson, parseImportedState, resetToSeed } from '../lib/storage'

export function Settings({
  state,
  setState,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}) {
  const fileRef = useRef<HTMLInputElement>(null)

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

  function downloadBackup() {
    const blob = new Blob([exportStateAsJson(state)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `p-finance-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importBackup(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const imported = parseImportedState(String(reader.result))
        setState(imported)
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
        <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Everything is stored only on this device. Download a backup to move data to another
          phone, or before clearing your browser data.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={downloadBackup}
            className="flex-1 rounded-lg py-2 text-sm font-medium"
            style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}
          >
            Export backup
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-1 rounded-lg py-2 text-sm font-medium"
            style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}
          >
            Import backup
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
    </div>
  )
}
