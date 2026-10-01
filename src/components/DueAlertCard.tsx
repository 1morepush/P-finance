import type { AppState } from '../types'
import { Card } from './Card'
import { formatCurrency, formatDate } from '../lib/finance'
import { dueItems } from '../lib/calendar'
import { addDays, paymentsBetween, sumConfirmed, today } from '../lib/schedule'

/** The window that matters for whether checking can take what is coming. */
const DAYS = 14

/**
 * Shown only when something needs doing: a payment past due, or less in the
 * bank than the next two weeks will take. Counts subscriptions with a day as
 * well as debts — they come out of the same account — so it agrees with the
 * week card and the calendar.
 */
export function DueAlertCard({ state, now = today() }: { state: AppState; now?: string }) {
  const items = dueItems(state, false, now)
  const overdue = sumConfirmed(items.filter((p) => p.date < now))
  const ahead = sumConfirmed(paymentsBetween(items, now, addDays(now, DAYS - 1)))
  const need = overdue + ahead
  const bank = state.bankBalance.amount
  const short = need - bank

  if (overdue <= 0 && short <= 0 && bank >= 0) return null

  return (
    <Card>
      <div className="flex items-start gap-2" role="alert">
        <span aria-hidden className="text-base leading-5">⚠</span>
        <div className="min-w-0 text-sm">
          {overdue > 0 && (
            <p className="font-semibold" style={{ color: 'var(--status-critical)' }}>
              {formatCurrency(overdue)} is past due.
            </p>
          )}
          {short > 0 ? (
            <p className={overdue > 0 ? 'mt-1' : 'font-semibold'} style={{ color: 'var(--status-critical)' }}>
              {formatCurrency(need)} goes out in the next {DAYS} days and the bank has{' '}
              {formatCurrency(bank)} — {formatCurrency(short)} short.
            </p>
          ) : (
            bank < 0 && (
              <p className="font-semibold" style={{ color: 'var(--status-critical)' }}>
                The bank is {formatCurrency(bank)}.
              </p>
            )
          )}
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Balance as of {formatDate(state.bankBalance.updatedAt)}. Hold off on extra payments until
            this is covered.
          </p>
        </div>
      </div>
    </Card>
  )
}
