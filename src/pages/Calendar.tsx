import { useMemo } from 'react'
import type { AppState } from '../types'
import { PRODUCT_LABEL } from '../types'
import { Card } from '../components/Card'
import { StatTile } from '../components/StatTile'
import { activeDebts, formatCurrency, formatDate, formatDue } from '../lib/finance'
import {
  addDays,
  addMonths,
  allPayments,
  daysUntil,
  debtFreeDate,
  formatMonth,
  formatShortDate,
  groupByMonth,
  installmentFreeDate,
  isDate,
  nextMonth,
  openingOfNextMonth,
  paymentsBetween,
  projectedPayoffDate,
  scheduleMismatches,
  sumConfirmed,
  sumPayments,
  sumPotential,
  today,
} from '../lib/schedule'

/** How far ahead the itemised list runs before collapsing into the payoff summary. */
const DETAIL_MONTHS = 6

/** How far into the following month each month block looks ahead. */
const LOOKAHEAD_DAYS = 14

export function Calendar({ state }: { state: AppState }) {
  const now = today()
  // Unconfirmed debts are included so nothing is a surprise, but every total
  // separates them out from the confirmed figure.
  const payments = useMemo(() => allPayments(state.debts, true), [state.debts])

  const next7 = paymentsBetween(payments, now, addDays(now, 7))
  const next14 = paymentsBetween(payments, now, addDays(now, 14))
  const next30 = paymentsBetween(payments, now, addDays(now, 30))

  const detailEnd = addMonths(now, DETAIL_MONTHS)
  const detail = paymentsBetween(payments, now, detailEnd)
  const beyond = payments.filter((p) => p.date > detailEnd)
  const months = groupByMonth(detail)

  const freeDate = installmentFreeDate(state.debts)
  const allFree = debtFreeDate(state.debts)
  const mismatches = scheduleMismatches(state.debts)

  const scheduled = activeDebts(state.debts)
    .map((d) => ({ debt: d, payoff: projectedPayoffDate(d) }))
    .filter((x) => x.payoff)
    .sort((a, b) => a.payoff!.localeCompare(b.payoff!))

  const unscheduled = activeDebts(state.debts).filter((d) => !projectedPayoffDate(d))

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <h1 className="text-lg font-semibold">Payment calendar</h1>

      {/* The reserve figure: what must survive whatever you throw at extra payoff. */}
      <Card>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ['Next 7 days', next7, 'var(--status-warning)'],
              ['Next 14 days', next14, undefined],
              ['Next 30 days', next30, undefined],
            ] as const
          ).map(([label, items, accent]) => {
            const confirmed = sumConfirmed(items)
            const potential = sumPotential(items)
            const n = items.filter((i) => !i.isPotential).length
            return (
              <StatTile
                key={label}
                label={label}
                value={formatCurrency(confirmed)}
                sub={
                  potential > 0
                    ? `${n} payment${n === 1 ? '' : 's'} · +${formatCurrency(potential)} unconfirmed`
                    : `${n} payment${n === 1 ? '' : 's'}`
                }
                accent={confirmed > 0 ? accent : undefined}
              />
            )
          })}
        </div>
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Keep at least the 14-day figure in checking before putting anything extra toward a single
          debt.
        </p>
        {state.bankBalance.amount < sumConfirmed(next14) && (
          <p className="mt-2 text-xs font-medium" style={{ color: 'var(--status-critical)' }}>
            ⚠ Your balance of {formatCurrency(state.bankBalance.amount)} is under the{' '}
            {formatCurrency(sumConfirmed(next14))} due in the next 14 days.
          </p>
        )}
      </Card>

      {months.length === 0 && (
        <Card>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No scheduled payments in the next {DETAIL_MONTHS} months.
          </p>
        </Card>
      )}

      {months.map(({ month, items }) => {
        const confirmed = sumConfirmed(items)
        const potential = sumPotential(items)
        const ahead = openingOfNextMonth(payments, month, LOOKAHEAD_DAYS)
        const aheadConfirmed = sumConfirmed(ahead)
        const aheadPotential = sumPotential(ahead)
        return (
        <section key={month} className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {formatMonth(month)}
            </h2>
            <span className="tabular-nums ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
              {items.length} payment{items.length === 1 ? '' : 's'}
            </span>
          </div>
          <Card>
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
              {items.map((p, i) => {
                const days = daysUntil(p.date, now)
                const soon = days <= 7
                return (
                  <div key={`${p.debtId}-${p.date}-${i}`} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span
                        className="shrink-0 text-xs tabular-nums"
                        style={{ color: soon ? 'var(--status-warning)' : 'var(--text-muted)' }}
                      >
                        {formatShortDate(p.date)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{p.debtName}</span>
                      <span className="tabular-nums shrink-0 text-sm font-medium">
                        {formatCurrency(p.amount)}
                      </span>
                    </div>
                    <div
                      className="mt-0.5 flex flex-wrap gap-2 text-[11px]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span>{PRODUCT_LABEL[p.product]}</span>
                      {days >= 0 && days <= 14 && <span>· in {days}d</span>}
                      {p.isPotential && (
                        <span style={{ color: 'var(--status-warning)' }}>· unconfirmed</span>
                      )}
                      {p.isFinal && !p.isPotential && (
                        <span style={{ color: 'var(--status-good)' }}>· final payment 🎉</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* End-of-month total, then what lands immediately after it. */}
            <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold">Total due in {formatMonth(month)}</span>
                <span className="tabular-nums text-sm font-semibold">
                  {formatCurrency(confirmed)}
                </span>
              </div>
              {potential > 0 && (
                <div className="mt-1 flex items-baseline justify-between gap-3 text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>+ unconfirmed</span>
                  <span className="tabular-nums" style={{ color: 'var(--status-warning)' }}>
                    {formatCurrency(potential)}
                  </span>
                </div>
              )}
              {aheadConfirmed + aheadPotential > 0 && (
                <div
                  className="mt-2 rounded-lg p-2"
                  style={{ background: 'var(--surface-page)' }}
                >
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Have ready for the first {LOOKAHEAD_DAYS} days of{' '}
                      {formatMonth(nextMonth(month)).split(' ')[0]}
                    </span>
                    <span className="tabular-nums font-semibold">
                      {formatCurrency(aheadConfirmed)}
                    </span>
                  </div>
                  {aheadPotential > 0 && (
                    <div className="mt-0.5 flex items-baseline justify-between gap-3 text-[11px]">
                      <span style={{ color: 'var(--text-muted)' }}>+ unconfirmed</span>
                      <span className="tabular-nums" style={{ color: 'var(--status-warning)' }}>
                        {formatCurrency(aheadPotential)}
                      </span>
                    </div>
                  )}
                  <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {ahead
                      .filter((a) => !a.isPotential)
                      .map((a) => a.debtName)
                      .join(', ') || '—'}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </section>
        )
      })}

      {beyond.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          + {beyond.length} further payment{beyond.length === 1 ? '' : 's'} totalling{' '}
          {formatCurrency(sumPayments(beyond))} after {formatMonth(detailEnd.slice(0, 7))}.
        </p>
      )}

      {/* Projected end dates */}
      <section className="flex flex-col gap-2">
        <h2 className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Projected payoff
        </h2>
        <Card>
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {scheduled.map(({ debt, payoff }) => (
              <div
                key={debt.id}
                className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0"
              >
                <span className="min-w-0 truncate">{debt.name}</span>
                <span className="tabular-nums shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {formatDate(payoff!)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {freeDate && (
          <Card>
            <StatTile
              label="Installment plans all clear"
              value={formatDate(freeDate)}
              sub="Affirm, Klarna and PayPal plans at their current payments"
              accent="var(--status-good)"
            />
            {allFree && allFree !== freeDate && (
              <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                Including the Apple Card at a fixed {formatCurrency(212)}/mo, everything scheduled
                clears by <strong>{formatDate(allFree)}</strong>. Card minimums usually shrink as
                the balance falls, which would push that out — holding the payment flat is what
                keeps it on this date.
              </p>
            )}
          </Card>
        )}
      </section>

      {unscheduled.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            No fixed schedule
          </h2>
          <Card>
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
              {unscheduled.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 truncate">{d.name}</span>
                  {d.nextDue && (
                    <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDue(d.nextDue)}
                    </span>
                  )}
                  <span className="tabular-nums shrink-0 font-medium">
                    {formatCurrency(d.balance)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {mismatches.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="mt-2 text-sm font-semibold" style={{ color: 'var(--status-warning)' }}>
            Schedule check
          </h2>
          <Card>
            <p className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              The recorded final payment date disagrees with the schedule implied by the balance,
              payment amount and billing cadence. The calendar uses the computed date.
            </p>
            {mismatches.map(({ debt, stated, computed }) => (
              <div key={debt.id} className="py-1 text-xs">
                <span className="font-medium">{debt.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {' '}
                  — recorded {isDate(stated) ? formatDate(stated) : stated}, computed{' '}
                  {formatDate(computed)}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  )
}
