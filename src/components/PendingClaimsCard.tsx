import type { AppState } from '../types'
import { Card } from './Card'
import { formatCurrency } from '../lib/finance'

/** Money that may come in — a claim, a reimbursement — kept out of every plan. */
export function PendingClaimsCard({ state }: { state: AppState }) {
  if (state.pendingClaims.length === 0) return null
  return (
    <Card>
      <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
        Potential upside (not counted in your plan)
      </h2>
      <div className="flex flex-col gap-3">
        {state.pendingClaims.map((c) => (
          <div key={c.id} className="text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>{c.name}</span>
              <span className="tabular-nums shrink-0" style={{ color: 'var(--status-warning)' }}>
                {c.low === c.high ? formatCurrency(c.low) : `${formatCurrency(c.low)}–${formatCurrency(c.high)}`}
              </span>
            </div>
            {c.notes && (
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                {c.notes}
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
