import type { AppState, Debt } from '../types'
import { PRODUCT_CADENCE } from '../types'
import { Card } from './Card'
import { activeDebts, formatCurrency, formatDate } from '../lib/finance'
import { ledgerMismatches } from '../lib/ledger'
import { isDate, scheduleMismatches } from '../lib/schedule'

/**
 * Everything about the debts that the app cannot trust until it is put right,
 * in one place. These were three cards on two tabs; each is a fault in the
 * figures, and each is fixed by opening the debt.
 */
export function NeedsFixingCard({
  state,
  onEdit,
  onOpenTab,
}: {
  state: AppState
  onEdit: (debt: Debt) => void
  onOpenTab: (id: string) => void
}) {
  // A scheduled payment with no date to fall on is in the total and nowhere
  // else — not on the calendar, not in any window, never settled.
  const undated = activeDebts(state.debts).filter(
    (d) => PRODUCT_CADENCE[d.product] && d.monthlyPayment && !isDate(d.nextDue),
  )
  // Nothing in the app should be able to put a tab out of step with its own
  // lines; this is here so that if something ever does, it is visible.
  const drifted = ledgerMismatches(state.debts)
  const mismatches = scheduleMismatches(state.debts)
  if (undated.length + drifted.length + mismatches.length === 0) return null

  const row = 'flex w-full items-center justify-between gap-2 py-1.5 text-left text-sm first:pt-0 last:pb-0'

  return (
    <Card>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--status-warning)' }}>
        Needs fixing
      </h2>

      {undated.length > 0 && (
        <div className="mt-2">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            <strong>No due date.</strong> {undated.length === 1 ? 'This plan has' : 'These plans have'} a
            monthly payment but no date for it to fall on, so{' '}
            {undated.length === 1 ? 'it is' : 'they are'} in the total and nowhere else — not on the
            calendar, not in any window, never settled. Tap to set one.
          </p>
          <div className="mt-1 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {undated.map((d) => (
              <button key={d.id} type="button" onClick={() => onEdit(d)} className={row}>
                <span className="min-w-0 truncate">{d.name}</span>
                <span className="tabular-nums shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {formatCurrency(d.monthlyPayment!)}/mo · {formatCurrency(d.balance)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {drifted.length > 0 && (
        <div className="mt-3">
          <p className="text-xs" style={{ color: 'var(--status-critical)' }}>
            <strong>A tab disagrees with its own lines.</strong> The lines are what the balance means —
            open the tab and add or correct one.
          </p>
          <div className="mt-1 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {drifted.map(({ debt, balance, fromLedger }) => (
              <button key={debt.id} type="button" onClick={() => onOpenTab(debt.id)} className={row}>
                <span className="min-w-0 truncate">{debt.name}</span>
                <span className="tabular-nums shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                  shows {formatCurrency(balance)} · lines {formatCurrency(fromLedger)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {mismatches.length > 0 && (
        <div className="mt-3">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            <strong>Final date doesn't fit.</strong> The recorded last payment disagrees with the one the
            balance, payment and cadence imply. The calendar uses the computed date.
          </p>
          <div className="mt-1 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {mismatches.map(({ debt, stated, computed }) => (
              <button key={debt.id} type="button" onClick={() => onEdit(debt)} className={row}>
                <span className="min-w-0 truncate">{debt.name}</span>
                <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                  recorded {isDate(stated) ? formatDate(stated) : stated} · computed {formatDate(computed)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
