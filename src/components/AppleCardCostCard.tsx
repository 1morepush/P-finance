import { useMemo } from 'react'
import type { AppState } from '../types'
import { Card } from './Card'
import { estimatePayoffMonths, formatCurrency } from '../lib/finance'
import { progress } from '../lib/history'

/**
 * What the card costs to carry at today's balance — per month, per day, and a
 * rough running total since the app started watching — and how long the
 * minimum takes. What extra payments would do is the what-if beside it.
 */
export function AppleCardCostCard({ state }: { state: AppState }) {
  const tracked = useMemo(() => progress(state), [state])
  const card = state.debts.find((d) => d.id === 'apple_card' && d.status === 'active')
  if (!card || card.balance <= 0) return null

  const months = card.apr && card.monthlyPayment ? estimatePayoffMonths(card.balance, card.apr, card.monthlyPayment) : null
  const monthly = (card.balance * card.apr) / 100 / 12
  const daily = (monthly * 12) / 365

  return (
    <Card>
      <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
        Apple Card payoff projection
      </h2>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {formatCurrency(card.balance)} at {card.apr}% APR
      </p>

      {/* The cost of standing still. The balance and the rate were both on
          screen; the number they multiply to never was. */}
      {monthly > 0 && (
        <div className="mt-2 rounded-lg p-2" style={{ background: 'var(--surface-page)' }}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span style={{ color: 'var(--text-secondary)' }}>Interest at this balance</span>
            <span className="tabular-nums font-semibold" style={{ color: 'var(--status-critical)' }}>
              {formatCurrency(monthly)}/mo
            </span>
          </div>
          <div
            className="mt-0.5 flex items-baseline justify-between gap-3 text-[11px]"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>{formatCurrency(daily)} a day, whatever else happens</span>
            {tracked.days > 0 && (
              <span className="tabular-nums">
                ≈ {formatCurrency(daily * tracked.days)} over the {tracked.days} days tracked
              </span>
            )}
          </div>
        </div>
      )}

      <p className="mt-2 text-sm">
        <span style={{ color: 'var(--text-secondary)' }}>
          At minimum ({formatCurrency(card.monthlyPayment ?? 0)}/mo):{' '}
        </span>
        <span className="tabular-nums font-medium">{months ? `${months} mo` : 'never clears interest'}</span>
      </p>
    </Card>
  )
}
