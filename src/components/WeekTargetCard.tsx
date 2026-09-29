import { useEffect, useRef, useState } from 'react'
import type { AppState } from '../types'
import { Card } from './Card'
import { formatCurrency } from '../lib/finance'
import { upcomingWeeks } from '../lib/week'
import { formatShortDate, overduePayments, overdueTotal } from '../lib/schedule'
import { averageNetPerShift, shiftNet, shiftsBetween } from '../lib/gig'

/**
 * What this week actually costs, from real due dates. The monthly average
 * flattens the lumps; the lumps are the thing that catches you out.
 */
/** How far ahead the strip runs: a year of weeks, swiped through sideways. */
const WEEKS_SHOWN = 52

export function WeekTargetCard({ state }: { state: AppState }) {
  const weeks = upcomingWeeks(state, WEEKS_SHOWN)
  const [picked, setPicked] = useState(0)
  const w = weeks[picked]
  const heaviest = Math.max(...weeks.map((x) => x.total), 1)

  // Keep the picked week's bar on screen when ‹ › steps past the edge of the
  // strip, so the bar and the figures above it never disagree about which
  // week is showing.
  const strip = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const bar = strip.current?.children[picked] as HTMLElement | undefined
    bar?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [picked])

  // Everything else on this screen looks forward from today, so a missed
  // instalment would otherwise appear nowhere at all.
  const overdue = overduePayments(state.debts)
  const overdueSum = overdueTotal(state.debts)

  const heavy = w.vsAverage > 1
  const tone = heavy ? 'var(--status-warning)' : 'var(--status-good)'

  // What this week's driving has already put toward this week's bill. The
  // target and the shifts lived on different tabs and never met.
  const worked = shiftsBetween(state.shifts, w.from, w.to)
  const earned = worked.reduce((s, x) => s + shiftNet(x), 0)
  const stillNeeded = Math.max(w.remaining - earned, 0)
  const perShift = averageNetPerShift(state.shifts)
  const shiftsToGo = perShift && perShift > 0 ? Math.ceil(stillNeeded / perShift) : null

  return (
    <Card>
      {overdue.length > 0 && (
        <div
          className="mb-3 rounded-lg p-2"
          style={{ background: 'var(--surface-page)', borderLeft: '3px solid var(--status-critical)' }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--status-critical)' }}>
              Already past due
            </span>
            <span className="tabular-nums text-sm font-semibold" style={{ color: 'var(--status-critical)' }}>
              {formatCurrency(overdueSum)}
            </span>
          </div>
          {overdue.map((p) => (
            <div
              key={`${p.debtId}-${p.date}`}
              className="flex items-baseline justify-between gap-2 text-[11px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span className="min-w-0 truncate">{p.debtName}</span>
              <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>
                {formatShortDate(p.date)}
              </span>
              <span className="tabular-nums shrink-0">{formatCurrency(p.amount)}</span>
            </div>
          ))}
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Not counted in the week below, which only looks forward. Mark these paid on the
            Calendar if they have gone through.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {picked === 0
            ? w.partial
              ? 'Left to cover this week'
              : 'Need to make this week'
            : picked === 1
              ? 'Next week'
              : `Week of ${formatShortDate(w.from).replace(/^\w+, /, '')}`}
        </h2>
        <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs" style={{ color: 'var(--text-muted)' }}>
          <button
            type="button"
            aria-label="Previous week"
            disabled={picked === 0}
            onClick={() => setPicked((i) => Math.max(i - 1, 0))}
            className="rounded px-1.5 disabled:opacity-30"
            style={{ background: 'var(--surface-page)' }}
          >
            ‹
          </button>
          {/* Weekday names dropped here: weeks always run Sunday to Saturday,
              and with them the range wrapped onto a second line on a phone. */}
          {formatShortDate(w.from).replace(/^\w+, /, '')} – {formatShortDate(w.to).replace(/^\w+, /, '')}
          <button
            type="button"
            aria-label="Next week"
            disabled={picked === weeks.length - 1}
            onClick={() => setPicked((i) => Math.min(i + 1, weeks.length - 1))}
            className="rounded px-1.5 disabled:opacity-30"
            style={{ background: 'var(--surface-page)' }}
          >
            ›
          </button>
        </span>
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <span className="tabular-nums text-3xl font-semibold" style={{ color: tone }}>
          {formatCurrency(w.remaining)}
        </span>
        {w.hoursNeeded !== null && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ≈ {w.hoursNeeded.toFixed(1)}h driving at {formatCurrency(w.netPerHour!)}/hr
          </span>
        )}
      </div>

      <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {formatCurrency(w.debtRemaining)} of debt
        {w.billsRemaining > 0 && <> + {formatCurrency(w.billsRemaining)} subscriptions</>}
        {w.livingCosts > 0 ? (
          <> + {formatCurrency(w.livingCosts)} everyday costs</>
        ) : state.expenses.length === 0 ? (
          ' · no living costs entered'
        ) : null}
        {w.potentialDue > 0 && (
          <span style={{ color: 'var(--status-warning)' }}>
            {' '}
            (+{formatCurrency(w.potentialDue)} unconfirmed)
          </span>
        )}
      </p>

      {/* A week already underway: say what has gone as well as what is left, so
          the bar in the strip and the headline are not read as the same number. */}
      {w.partial && w.debtPassed > 0.005 && (
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {formatCurrency(w.debtPassed)} of this week fell earlier — {formatCurrency(w.total)} across
          the whole week.
        </p>
      )}

      {picked === 0 && (earned > 0 || perShift !== null) && (
        <div className="mt-2 rounded-lg p-2" style={{ background: 'var(--surface-page)' }}>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span style={{ color: 'var(--text-secondary)' }}>
              Earned this week
              {worked.length > 0 && (
                <span style={{ color: 'var(--text-muted)' }}>
                  {' '}· {worked.length} shift{worked.length === 1 ? '' : 's'}
                </span>
              )}
            </span>
            <span className="tabular-nums font-semibold" style={{ color: 'var(--status-good)' }}>
              {formatCurrency(earned)}
            </span>
          </div>
          <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs">
            <span style={{ color: 'var(--text-secondary)' }}>Still to find</span>
            <span
              className="tabular-nums font-semibold"
              style={{ color: stillNeeded > 0 ? 'var(--status-warning)' : 'var(--status-good)' }}
            >
              {formatCurrency(stillNeeded)}
            </span>
          </div>
          {stillNeeded > 0 && shiftsToGo !== null && (
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              About {shiftsToGo} more shift{shiftsToGo === 1 ? '' : 's'} at your average of{' '}
              {formatCurrency(perShift!)} net each.
            </p>
          )}
          {stillNeeded === 0 && earned > 0 && (
            <p className="mt-1 text-[11px]" style={{ color: 'var(--status-good)' }}>
              This week is covered.
            </p>
          )}
        </div>
      )}

      <p className="mt-1 text-xs" style={{ color: heavy ? 'var(--status-warning)' : 'var(--text-muted)' }}>
        {Math.abs(w.vsAverage) < 1 ? (
          <>About an average week ({formatCurrency(w.averageWeek)}).</>
        ) : heavy ? (
          <>
            {formatCurrency(w.vsAverage)} heavier than an average week (
            {formatCurrency(w.averageWeek)}) — the bills cluster here.
          </>
        ) : (
          <>
            {formatCurrency(-w.vsAverage)} lighter than an average week (
            {formatCurrency(w.averageWeek)}) — a good week to get ahead.
          </>
        )}
      </p>

      {/* A year of weeks, swiped sideways, so a heavy one is visible long
          before it lands. The bars share one scale across the whole year. */}
      <div
        ref={strip}
        className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1 pb-1"
        style={{ scrollSnapType: 'x proximity' }}
      >
        {weeks.map((x, i) => {
          const monthTurns = i > 0 && x.from.slice(5, 7) !== weeks[i - 1].from.slice(5, 7)
          return (
            <button
              key={x.from}
              type="button"
              onClick={() => setPicked(i)}
              className="flex w-12 shrink-0 flex-col items-center gap-1 rounded-lg px-1 py-1.5"
              style={{
                background: i === picked ? 'var(--surface-page)' : 'transparent',
                scrollSnapAlign: 'center',
              }}
            >
              <span className="tabular-nums text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {Math.round(x.total)}
              </span>
              <span className="flex h-7 w-full items-end">
                <span
                  className="w-full rounded-sm"
                  style={{
                    height: `${Math.max((x.total / heaviest) * 28, 3)}px`,
                    background:
                      x.vsAverage > 1
                        ? 'var(--status-warning)'
                        : i === picked
                          ? 'var(--cat-installment)'
                          : 'var(--border)',
                  }}
                />
              </span>
              <span
                className="whitespace-nowrap text-[10px]"
                style={{
                  color: monthTurns ? 'var(--text-secondary)' : 'var(--text-muted)',
                  fontWeight: monthTurns ? 600 : 400,
                }}
              >
                {i === 0 ? 'this wk' : formatShortDate(x.from).replace(/^\w+, /, '')}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
        Swipe for the weeks ahead — a year of them. Tap one to see what it holds.
      </p>

      {w.itemsRemaining.length > 0 && (
        <div className="mt-3 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
          {w.itemsRemaining.map((p) => (
            <div
              key={`${p.debtId}-${p.date}`}
              className="flex items-center justify-between gap-2 py-1.5 text-xs first:pt-0 last:pb-0"
            >
              <span className="flex min-w-0 items-center gap-1.5 truncate">
                {p.product === 'bill' && (
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: 'var(--cat-bill)' }}
                    title="Subscription"
                  />
                )}
                <span className="truncate">{p.debtName}</span>
              </span>
              <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>
                {formatShortDate(p.date)}
              </span>
              <span className="tabular-nums shrink-0 font-medium">{formatCurrency(p.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {w.itemsRemaining.length === 0 && (
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {w.partial && w.debtPassed > 0.005
            ? 'Nothing left to pay this week.'
            : 'Nothing falls due in this week.'}
        </p>
      )}
    </Card>
  )
}
