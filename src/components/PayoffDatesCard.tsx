import type { AppState } from '../types'
import { Card } from './Card'
import { StatTile } from './StatTile'
import { activeDebts, formatCurrency, formatDate } from '../lib/finance'
import { debtFreeDate, installmentFreeDate, projectedPayoffDate } from '../lib/schedule'

/**
 * When each debt is gone at its current payment, soonest first. Debts with no
 * schedule — the tabs with people — are named at the end rather than listed
 * again; they are in the list above, and they end when they are paid.
 */
export function PayoffDatesCard({ state }: { state: AppState }) {
  const active = activeDebts(state.debts)
  const scheduled = active
    .map((d) => ({ debt: d, payoff: projectedPayoffDate(d) }))
    .filter((x): x is { debt: (typeof active)[number]; payoff: string } => !!x.payoff)
    .sort((a, b) => a.payoff.localeCompare(b.payoff))
  const open = active.filter((d) => !projectedPayoffDate(d))
  const freeDate = installmentFreeDate(state.debts)
  const allFree = debtFreeDate(state.debts)
  const card = active.find((d) => d.product === 'credit_card')

  if (scheduled.length === 0 && open.length === 0) return null

  return (
    <Card>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
        When each debt finishes
      </h2>
      {freeDate && (
        <div className="mt-2">
          <StatTile
            label="Installment plans all clear"
            value={formatDate(freeDate)}
            sub="Affirm, Klarna and PayPal plans at their current payments"
            accent="var(--status-good)"
          />
        </div>
      )}
      <div className="mt-3 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
        {scheduled.map(({ debt, payoff }) => (
          <div key={debt.id} className="flex items-center justify-between gap-3 py-1.5 text-sm first:pt-0 last:pb-0">
            <span className="min-w-0 truncate">{debt.name}</span>
            <span className="tabular-nums shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
              {formatDate(payoff)}
            </span>
          </div>
        ))}
      </div>
      {allFree && allFree !== freeDate && card?.monthlyPayment && (
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Including the Apple Card at a fixed {formatCurrency(card.monthlyPayment)}/mo, everything scheduled
          clears by <strong>{formatDate(allFree)}</strong>. Card minimums usually shrink as the balance
          falls, which would push that out — holding the payment flat is what keeps it on this date.
        </p>
      )}
      {open.length > 0 && (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          No fixed end: {open.map((d) => d.name).join(', ')} — {formatCurrency(open.reduce((s, d) => s + d.balance, 0))},
          paid as and when.
        </p>
      )}
    </Card>
  )
}
