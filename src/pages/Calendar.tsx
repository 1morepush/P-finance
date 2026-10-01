import { useMemo, useState } from 'react'
import type { AppState } from '../types'
import { Card } from '../components/Card'
import { MonthGrid } from '../components/MonthGrid'
import { applyPayment, undoPayment } from '../lib/payments'
import { StatTile } from '../components/StatTile'
import { formatCurrency } from '../lib/finance'
import { calendarEntries, dueItems, earliestMonth, monthTotals } from '../lib/calendar'
import { paymentsToICS } from '../lib/ics'
import { deliverFile } from '../lib/share'
import {
  addDays,
  addMonths,
  daysUntil,
  formatMonth,
  formatShortDate,
  groupByMonth,
  nextMonth,
  openingOfNextMonth,
  paymentLabel,
  paymentsBetween,
  sumConfirmed,
  sumPayments,
  sumPotential,
  today,
} from '../lib/schedule'

/** How far ahead the itemised list runs before collapsing into the payoff summary. */
const DETAIL_MONTHS = 6
/** Month grids shown before "Show more" — this month and the next five. */
const STACKED_MONTHS = 6

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
  const thisMonth = now.slice(0, 7)
  // Months stacked and scrolled rather than stepped through one at a time:
  // comparing one month's bills with the next's shouldn't mean tapping back
  // and forth. Starts at this month; more load on request in either direction.
  const [monthsBefore, setMonthsBefore] = useState(0)
  const [monthsAfter, setMonthsAfter] = useState(STACKED_MONTHS - 1)
  // The month a day was tapped in, not just the date: the last days of one
  // month also appear at the top of the next, and the detail should open
  // under the grid that was actually tapped.
  const [selected, setSelected] = useState<{ month: string; date: string } | null>(null)
  // Unconfirmed debts are included so nothing is a surprise, but every total
  // separates them out from the confirmed figure.
  // Subscriptions with a due date come out of the same account on the same
  // days, so every total and list here counts them alongside the debts.
  const payments = useMemo(() => dueItems(state, true, now), [state, now])
  // The grid shows both halves: what has been paid as well as what is coming.
  // The lists below it stay forward-looking — they answer "what do I owe".
  const entries = useMemo(() => calendarEntries(state, true), [state])
  const firstMonth = earliestMonth(entries)
  const stackStart = addMonths(`${thisMonth}-01`, -monthsBefore).slice(0, 7)
  const stack = Array.from({ length: monthsBefore + 1 + monthsAfter }, (_, i) =>
    addMonths(`${stackStart}-01`, i).slice(0, 7),
  )
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
    const { text, count } = paymentsToICS(state.debts, now, 365, new Date(), state.expenses)
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

      {/* The key and the export sit above the months they describe. */}
      <Card>
        <div
          className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]"
          style={{ color: 'var(--text-muted)' }}
        >
          {[
            ['Paid', 'var(--status-good)'],
            ['Instalment', 'var(--cat-installment)'],
            ['Apple Card', 'var(--cat-revolving)'],
            ['Personal', 'var(--cat-personal)'],
            ['Subscriptions', 'var(--cat-bill)'],
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
      </Card>

      {firstMonth && firstMonth < stackStart && (
        <button
          type="button"
          onClick={() => setMonthsBefore((n) => n + 3)}
          className="w-full rounded-lg py-2 text-xs font-medium"
          style={{ background: 'var(--surface-card)', color: 'var(--text-secondary)' }}
        >
          Show earlier months — history runs back to {formatMonth(firstMonth)}
        </button>
      )}

      {stack.map((m) => (
        <Card key={m}>
          <MonthGrid
            month={m}
            entries={entries}
            today={now}
            selected={selected?.month === m ? selected.date : null}
            onSelect={(date) => setSelected(date ? { month: m, date } : null)}
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
        </Card>
      ))}

      <button
        type="button"
        onClick={() => setMonthsAfter((n) => n + STACKED_MONTHS)}
        className="w-full rounded-lg py-2 text-xs font-medium"
        style={{ background: 'var(--surface-card)', color: 'var(--text-secondary)' }}
      >
        Show {STACKED_MONTHS} more months
      </button>

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
                      <span>{paymentLabel(p)}</span>
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
    </div>
  )
}
