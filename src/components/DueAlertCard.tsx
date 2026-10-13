import type { AppState } from '../types'
import { Card } from './Card'
import { formatCurrency, formatDate } from '../lib/finance'
import { dueItems } from '../lib/calendar'
import { addDays, formatShortDate, paymentsBetween, sumConfirmed, today } from '../lib/schedule'
import { expectedPay, nextPayday, paydaysBetween } from '../lib/payday'

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
  const end = addDays(now, DAYS - 1)
  const ahead = sumConfirmed(paymentsBetween(items, now, end))
  const need = overdue + ahead
  const bank = state.bankBalance.amount
  const short = need - bank

  if (overdue <= 0 && short <= 0 && bank >= 0) return null

  // Payday changes what "short" means: what has to come out before the next
  // check is the bank's alone to cover; what falls after it has the check too.
  // A payment due on payday itself is counted after it — the deposit lands
  // first thing.
  const payday = nextPayday(state, now)
  const pay = expectedPay(state)
  const checks = payday ? paydaysBetween(state, now, end).length : 0
  const beforePay = payday ? sumConfirmed(items.filter((p) => p.date >= now && p.date < payday)) : 0
  const shortBeforePay = overdue + beforePay - bank
  const shortAfterPay = pay !== null ? short - pay * checks : null
  const day = payday ? formatShortDate(payday) : ''

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
          {payday && (short > 0 || overdue > 0) && (
            <div className="mt-1 text-xs" data-payday={payday}>
              <p
                style={{
                  color: shortBeforePay > 0 ? 'var(--status-critical)' : 'var(--status-good)',
                }}
              >
                {shortBeforePay > 0
                  ? `Before payday (${day}): ${formatCurrency(overdue + beforePay)} is due and the bank has ${formatCurrency(bank)} — ${formatCurrency(shortBeforePay)} short until then.`
                  : `Before payday (${day}): ${formatCurrency(overdue + beforePay)} is due, which the bank covers.`}
              </p>
              {shortAfterPay === null ? (
                <p className="mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Add your pay under Income → FedEx paycheck estimate to see whether payday covers the rest.
                </p>
              ) : (
                <p
                  className="mt-0.5"
                  style={{ color: shortAfterPay > 0 ? 'var(--status-critical)' : 'var(--status-good)' }}
                >
                  {checks === 1 ? `${day}'s paycheck` : `${checks} paychecks from ${day}`} (about{' '}
                  {formatCurrency(pay ?? 0)}
                  {checks > 1 ? ' each' : ''}){' '}
                  {shortAfterPay > 0
                    ? `still leaves ${formatCurrency(shortAfterPay)} short over the ${DAYS} days.`
                    : `covers the rest of the ${DAYS} days, with about ${formatCurrency(-shortAfterPay)} to spare.`}
                </p>
              )}
            </div>
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
