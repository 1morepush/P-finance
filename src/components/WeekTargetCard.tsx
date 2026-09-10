import { useState } from 'react'
import type { AppState } from '../types'
import { Card } from './Card'
import { formatCurrency } from '../lib/finance'
import { upcomingWeeks } from '../lib/week'
import { formatShortDate } from '../lib/schedule'

/**
 * What this week actually costs, from real due dates. The monthly average
 * flattens the lumps; the lumps are the thing that catches you out.
 */
export function WeekTargetCard({ state }: { state: AppState }) {
  const weeks = upcomingWeeks(state, 4)
  const [picked, setPicked] = useState(0)
  const w = weeks[picked]
  const heaviest = Math.max(...weeks.map((x) => x.total), 1)

  const heavy = w.vsAverage > 1
  const tone = heavy ? 'var(--status-warning)' : 'var(--status-good)'

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {picked === 0 ? 'Need to make this week' : 'That week'}
        </h2>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {formatShortDate(w.from)} – {formatShortDate(w.to)}
        </span>
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <span className="tabular-nums text-3xl font-semibold" style={{ color: tone }}>
          {formatCurrency(w.total)}
        </span>
        {w.hoursNeeded !== null && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ≈ {w.hoursNeeded.toFixed(1)}h driving at {formatCurrency(w.netPerHour!)}/hr
          </span>
        )}
      </div>

      <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {formatCurrency(w.debtDue)} of debt actually due
        {w.livingCosts > 0 ? <> + {formatCurrency(w.livingCosts)} living costs</> : ' · no living costs entered'}
        {w.potentialDue > 0 && (
          <span style={{ color: 'var(--status-warning)' }}>
            {' '}
            (+{formatCurrency(w.potentialDue)} unconfirmed)
          </span>
        )}
      </p>

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

      {/* Four weeks at a glance, so a heavy one is visible before it lands. */}
      <div className="mt-3 flex gap-1">
        {weeks.map((x, i) => (
          <button
            key={x.from}
            type="button"
            onClick={() => setPicked(i)}
            className="flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5"
            style={{ background: i === picked ? 'var(--surface-page)' : 'transparent' }}
          >
            <span className="tabular-nums text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {Math.round(x.total)}
            </span>
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
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {i === 0 ? 'now' : formatShortDate(x.from).replace(/^\w+, /, '')}
            </span>
          </button>
        ))}
      </div>

      {w.items.length > 0 && (
        <div className="mt-3 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
          {w.items.map((p) => (
            <div
              key={`${p.debtId}-${p.date}`}
              className="flex items-center justify-between gap-2 py-1.5 text-xs first:pt-0 last:pb-0"
            >
              <span className="min-w-0 truncate">{p.debtName}</span>
              <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>
                {formatShortDate(p.date)}
              </span>
              <span className="tabular-nums shrink-0 font-medium">{formatCurrency(p.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {w.items.length === 0 && (
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Nothing falls due in this window.
        </p>
      )}
    </Card>
  )
}
