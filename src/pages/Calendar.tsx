import { useMemo, useState } from 'react'
import type { AppState } from '../types'
import { PRODUCT_LABEL } from '../types'
import { Card } from '../components/Card'
import { MonthGrid } from '../components/MonthGrid'
import { applyPayment, undoPayment } from '../lib/payments'
import { StatTile } from '../components/StatTile'
import { activeDebts, formatCurrency, formatDate, formatDue } from '../lib/finance'
import { calendarEntries, earliestMonth, monthTotals } from '../lib/calendar'
import { paymentsToICS } from '../lib/ics'
import { deliverFile } from '../lib/share'
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

export function Calendar({
  state,
  setState,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}) {
  const now = today()
  const [gridMonth, setGridMonth] = useState(now.slice(0, 7))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  // Unconfirmed debts are included so nothing is a surprise, but every total
  // separates them out from the confirmed figure.
  const payments = useMemo(() => allPayments(state.debts, true), [state.debts])
  // The grid shows both halves: what has been paid as well as what is coming.
  // The lists below it stay forward-looking — they answer "what do I owe".
  const entries = useMemo(() => calendarEntries(state, true), [state])
  const firstMonth = earliestMonth(entries)
  const [exported, setExported] = useState<string | null>(null)

  // Past due and still standing: owed now, and part of every window. Each
  // window is N days counting today, the same arithmetic every other figure
  // uses — these used to run a day longer and disagree with the Runway.
  const overdue = payments.filter((p) => p.date < now && !p.isPotential)
  const next7 = [...overdue, ...paymentsBetween(payments, now, addDays(now, 6))]
  const next14 = [...overdue, ...paymentsBetween(payments, now, addDays(now, 13))]
  const next30 = [...overdue, ...paymentsBetween(payments, now, addDays(now, 29))]
  const overdueSum = sumConfirmed(overdue)

  async function exportCalendar() {
    const { text, count } = paymentsToICS(state.debts, now)
    const how = await deliverFile(`debt-payments-${now}.ics`, text, 'text/calendar')
    if (how === 'cancelled') return
    setExported(
      `${count} payment${count === 1 ? '' : 's'} ${how === 'shared' ? 'sent to the share sheet' : 'downloaded'} — open the file and your calendar will offer to add them, each with a reminder the evening before.`,
    )
  }

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
            const parts = [`${n} payment${n === 1 ? '' : 's'}`]
            if (overdueSum > 0) parts.push(`${formatCurrency(overdueSum)} past due`)
            if (potential > 0) parts.push(`+${formatCurrency(potential)} unconfirmed`)
            return (
              <StatTile
                key={label}
                label={label}
                value={formatCurrency(confirmed)}
                sub={parts.join(' · ')}
                accent={confirmed > 0 ? (overdueSum > 0 ? 'var(--status-critical)' : accent) : undefined}
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

      <Card>
        <MonthGrid
          month={gridMonth}
          entries={entries}
          today={now}
          selected={selectedDay}
          onSelect={setSelectedDay}
          onMonthChange={(m) => {
            setGridMonth(m)
            setSelectedDay(null)
          }}
          onPay={(e) =>
            // Routed through applyPayment like any other, so it lands in history
            // and can be undone from the Debts tab.
            //
            // Dated today when the instalment is still ahead: tapping a future
            // one means paying it early, and stamping it with its own due date
            // would put a payment in the future — which the progress chart then
            // plots to the right of today and draws backwards.
            setState((s) =>
              applyPayment(s, {
                debtId: e.debtId,
                amount: e.amount,
                date: e.date > now ? now : e.date,
                fromBank: true,
                advanceDue: true,
              }),
            )
          }
          onUndo={(paymentId) => setState((s) => undoPayment(s, paymentId))}
        />
        {gridMonth !== now.slice(0, 7) && (
          <button
            type="button"
            onClick={() => {
              setGridMonth(now.slice(0, 7))
              setSelectedDay(null)
            }}
            className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium"
            style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}
          >
            Back to this month
          </button>
        )}
        {/* Nothing in the header says the arrows go backwards as well as
            forwards, and a month of settled payments is easy to never find. */}
        {firstMonth && firstMonth < now.slice(0, 7) && (
          <p className="mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            History runs back to {formatMonth(firstMonth)} — tap ‹ to look at what has already been
            paid.
          </p>
        )}

        {/* Reminders that fire whether or not this app is ever opened again. */}
        <button
          type="button"
          onClick={() => void exportCalendar()}
          className="mt-3 w-full rounded-lg py-2 text-xs font-medium"
          style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}
        >
          Add the next year of payments to my phone's calendar
        </button>
        {exported && (
          <p className="mt-2 text-[11px]" style={{ color: 'var(--status-good)' }}>
            ✓ {exported}
          </p>
        )}
        <div
          className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px]"
          style={{ color: 'var(--text-muted)' }}
        >
          {[
            ['Paid', 'var(--status-good)'],
            ['Instalment', 'var(--cat-installment)'],
            ['Apple Card', 'var(--cat-revolving)'],
            ['Personal', 'var(--cat-personal)'],
            ['Unconfirmed', 'var(--status-warning)'],
          ].map(([label, color]) => (
            <span key={label} className="flex items-center gap-1">
              <span
                className="inline-block h-[3px] w-[3px] rounded-full"
                style={{ background: color }}
              />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ outline: '1.5px solid var(--status-good)', outlineOffset: '-1.5px' }}
            />
            Today
          </span>
        </div>
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
        const paidThisMonth = monthTotals(entries, month).paid
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
                <span className="text-sm font-semibold">
                  {paidThisMonth > 0 ? 'Still due in' : 'Total due in'} {formatMonth(month)}
                </span>
                <span className="tabular-nums text-sm font-semibold">
                  {formatCurrency(confirmed)}
                </span>
              </div>
              {/* This list starts at today, so in the current month the total
                  above is the remainder. Without this line it reads as the
                  whole month and looks lighter than the month actually was. */}
              {paidThisMonth > 0 && (
                <div className="mt-1 flex items-baseline justify-between gap-3 text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>Already paid this month</span>
                  <span className="tabular-nums" style={{ color: 'var(--status-good)' }}>
                    {formatCurrency(paidThisMonth)}
                  </span>
                </div>
              )}
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
