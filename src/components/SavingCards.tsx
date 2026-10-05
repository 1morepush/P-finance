import { useState } from 'react'
import type { AppState } from '../types'
import { Card } from './Card'
import { formatCurrency } from '../lib/finance'
import { floorStatus, fundsOf, moveToFund, spendFromFund } from '../lib/recovery'

/**
 * The checking floor, built in steps. The Sep 14 overdraft cost $36 and
 * started a rough week; this is what stops the next one.
 */
export function FloorCard({ state }: { state: AppState }) {
  const f = floorStatus(state)
  const bank = state.bankBalance.amount
  const pct = Math.max(0, Math.min(1, bank / f.target))
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Your checking floor
        </h2>
        <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
          goal {formatCurrency(f.target)}
        </span>
      </div>
      <div className="relative mt-3 h-2 rounded-full" style={{ background: 'var(--surface-page)' }}>
        <div
          className="h-2 rounded-full"
          style={{ width: `${pct * 100}%`, background: f.reached ? 'var(--status-good)' : 'var(--cat-installment)' }}
        />
        {f.steps.map((s) => (
          <span
            key={s}
            className="absolute -top-0.5 h-3 w-0.5"
            style={{ left: `calc(${(s / f.target) * 100}% - 1px)`, background: 'var(--text-muted)' }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
        <span>$0</span>
        {f.steps.map((s) => (
          <span key={s}>{formatCurrency(s).replace('.00', '')}</span>
        ))}
      </div>
      <p className="mt-2 text-sm">
        {f.reached ? (
          <span style={{ color: 'var(--status-good)' }}>✓ PNC is at or above the floor.</span>
        ) : (
          <>
            {formatCurrency(bank)} now — <strong>{formatCurrency(f.toGo)}</strong> to the{' '}
            {formatCurrency(f.step!).replace('.00', '')} step.
          </>
        )}
      </p>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Build PNC to $300 in steps: $100, then $200, then $300. Don't spend below it except in a true
        emergency. The Sep 14 overdraft cost $36 and started a rough week, and this floor is what stops
        the next one.
      </p>
    </Card>
  )
}

/**
 * Sinking funds, kept in Capital One 360 or SoFi, away from the PNC autopays.
 * Moving money in takes it out of the PNC balance here too.
 */
export function FundsCard({
  state,
  setState,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}) {
  const [spending, setSpending] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const floor = floorStatus(state)
  return (
    <Card>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
        Sinking funds
      </h2>
      <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Keep these in your Capital One 360 or SoFi account, away from the PNC autopays.
      </p>
      <div className="mt-2 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
        {fundsOf(state).map((f) => {
          const waiting = f.afterFloor && !floor.reached
          return (
            <div key={f.id} className="py-2 first:pt-0 last:pb-0" data-fund={f.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">
                  {f.name}
                  <span className="ml-1 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                    · {formatCurrency(f.perWeek).replace('.00', '')} a week
                  </span>
                </span>
                <span className="tabular-nums text-sm font-semibold">{formatCurrency(f.balance)}</span>
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {f.covers}
                {waiting && ` · starts once the floor hits ${formatCurrency(floor.target).replace('.00', '')}`}
              </p>
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  disabled={waiting}
                  onClick={() => setState((s) => moveToFund(s, f.id, f.perWeek))}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium disabled:opacity-40"
                  style={{ background: 'var(--status-good)', color: 'white' }}
                >
                  Moved {formatCurrency(f.perWeek).replace('.00', '')} from PNC
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSpending(spending === f.id ? null : f.id)
                    setAmount('')
                  }}
                  className="rounded-lg px-2.5 py-1 text-xs"
                  style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}
                >
                  {spending === f.id ? 'Cancel' : 'Spent from it'}
                </button>
              </div>
              {spending === f.id && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={amount}
                    placeholder="0.00"
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-lg border px-2 py-1.5 text-sm"
                    style={{ background: 'var(--surface-page)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    aria-label={`Spent from the ${f.name} fund`}
                  />
                  <button
                    type="button"
                    disabled={!(Number(amount) > 0)}
                    onClick={() => {
                      setState((s) => spendFromFund(s, f.id, Number(amount)))
                      setSpending(null)
                    }}
                    className="rounded-lg px-3 text-xs font-medium disabled:opacity-40"
                    style={{ background: 'var(--cat-installment)', color: 'white' }}
                  >
                    Take out
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
