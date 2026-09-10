import { useState } from 'react'
import type { Debt } from '../types'
import { Card } from './Card'
import { formatCurrency, formatDate } from '../lib/finance'
import { extraPaymentEffect } from '../lib/payoff'

/**
 * What paying more each month does to a revolving balance.
 *
 * Only revolving debt responds to this: a fixed plan's balance already contains
 * its financing charge, so paying it faster finishes sooner without costing
 * less. Here every extra dollar is interest never charged.
 */
export function WhatIfCard({ debt }: { debt: Debt }) {
  const [extra, setExtra] = useState(0)
  const now = extraPaymentEffect(debt, 0)
  const withExtra = extraPaymentEffect(debt, extra)

  const monthsLabel = (m: number | null) =>
    m === null ? 'never clears' : m < 24 ? `${m} months` : `${(m / 12).toFixed(1)} years`

  return (
    <Card>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
        What if I paid more on {debt.name}?
      </h2>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
        {formatCurrency(debt.balance)} at {debt.apr}% · {formatCurrency(debt.monthlyPayment ?? 0)}/mo
        scheduled
      </p>

      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={500}
          step={10}
          value={extra}
          onChange={(e) => setExtra(Number(e.target.value))}
          className="w-full"
          aria-label="Extra per month"
        />
        <span className="tabular-nums w-20 shrink-0 text-right text-sm font-semibold">
          +{formatCurrency(extra)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg p-2" style={{ background: 'var(--surface-page)' }}>
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Paid off in
          </div>
          <div className="tabular-nums text-lg font-semibold">
            {monthsLabel(withExtra.months)}
          </div>
          {withExtra.payoffDate && (
            <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              by {formatDate(withExtra.payoffDate)}
            </div>
          )}
        </div>
        <div className="rounded-lg p-2" style={{ background: 'var(--surface-page)' }}>
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Interest you'll pay
          </div>
          <div
            className="tabular-nums text-lg font-semibold"
            style={{ color: extra > 0 ? 'var(--status-good)' : undefined }}
          >
            {Number.isFinite(withExtra.interest) ? formatCurrency(withExtra.interest) : '—'}
          </div>
          {extra > 0 && (
            <div className="text-[11px]" style={{ color: 'var(--status-good)' }}>
              saves {formatCurrency(withExtra.interestSaved)}
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {extra === 0 ? (
          <>
            At the scheduled payment alone this runs {monthsLabel(now.months)} and costs{' '}
            {Number.isFinite(now.interest) ? formatCurrency(now.interest) : '—'} in interest. Drag
            the slider to see what more would do.
          </>
        ) : (
          <>
            {formatCurrency(extra)} a month more finishes it{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {withExtra.monthsSaved} months
            </strong>{' '}
            sooner and saves{' '}
            <strong style={{ color: 'var(--status-good)' }}>
              {formatCurrency(withExtra.interestSaved)}
            </strong>{' '}
            — about {formatCurrency(withExtra.interestSaved / Math.max(withExtra.months ?? 1, 1))} back
            for every {formatCurrency(extra)} put in.
          </>
        )}
      </p>
    </Card>
  )
}
