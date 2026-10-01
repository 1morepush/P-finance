import { useMemo, useState } from 'react'
import type { AppState, DebtStrategy } from '../types'
import { Card } from './Card'
import { formatCurrency } from '../lib/finance'
import { compareStrategies, STRATEGY_LABEL } from '../lib/strategy'

/**
 * Which order extra money goes to the debts, and what each order costs.
 *
 * Lives with the debts it orders. In Settings it sat a tab away from the list
 * it rearranged, and from the payoff figures it is weighed against.
 */
export function StrategyCard({
  state,
  setState,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}) {
  const [extra, setExtra] = useState('100')
  const extraPerMonth = Number(extra) || 0
  const comparison = useMemo(() => compareStrategies(state, extraPerMonth), [state, extraPerMonth])

  function setStrategy(strategy: DebtStrategy) {
    setState((s) => ({ ...s, settings: { ...s.settings, strategy } }))
  }

  return (
    <>
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
    </>
  )
}
