import type { AppState } from '../types'
import { categoryOf } from '../types'
import { Card } from './Card'
import { StatTile } from './StatTile'
import { CategoryBar } from './CategoryBar'
import { activeDebts, formatCurrency, formatDate, totalCleared, totalDebt, totalPotentialDebt } from '../lib/finance'
import { installmentFreeDate } from '../lib/schedule'

/** What is owed in total, what kind it is, and what has gone already. */
export function DebtSummaryCard({ state }: { state: AppState }) {
  const debts = activeDebts(state.debts)
  const total = totalDebt(state.debts)
  const potential = totalPotentialDebt(state.debts)
  const cleared = totalCleared(state.clearedDebts)
  const lastPayoff = installmentFreeDate(state.debts)
  const sum = (c: ReturnType<typeof categoryOf>) =>
    debts.filter((d) => categoryOf(d) === c).reduce((s, d) => s + d.balance, 0)

  return (
    <Card>
      <div className="grid grid-cols-2 gap-4">
        <StatTile
          label="Total active debt"
          value={formatCurrency(total)}
          sub={potential > 0 ? `+ ${formatCurrency(potential)} unconfirmed` : undefined}
        />
        <StatTile label="Paid off so far" value={formatCurrency(cleared)} accent="var(--status-good)" />
      </div>
      <div className="mt-4">
        <CategoryBar
          segments={[
            { label: 'Installment', value: sum('installment'), color: 'var(--cat-installment)' },
            { label: 'Revolving', value: sum('revolving'), color: 'var(--cat-revolving)' },
            { label: 'Personal', value: sum('personal'), color: 'var(--cat-personal)' },
          ]}
        />
      </div>
      {lastPayoff && (
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          All fixed-schedule installment debt clears by {formatDate(lastPayoff)} at minimum payments.
        </p>
      )}
    </Card>
  )
}
