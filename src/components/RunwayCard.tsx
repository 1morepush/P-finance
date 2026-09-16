import type { AppState } from '../types'
import { Card } from './Card'
import { formatCurrency, formatDate } from '../lib/finance'
import { formatMonth } from '../lib/schedule'
import { minimumsShareOfIncome, runway } from '../lib/budget'
import { daysUntil } from '../lib/schedule'

/** Cover expressed in whatever unit is legible at that length. */
function coverPhrase(months: number): string {
  const days = Math.round(months * 30.44)
  if (days <= 13) return `${days} day${days === 1 ? '' : 's'}`
  if (months < 1.5) return `${Math.round(months * 4.345)} weeks`
  return `${months.toFixed(1)} months`
}

/**
 * Whether the plan survives the next few months, as opposed to how the debt is
 * going. It leads the dashboard because a payoff order is beside the point if
 * the income behind it stops.
 */
export function RunwayCard({ state, onAddExpenses }: { state: AppState; onAddExpenses: () => void }) {
  const r = runway(state)
  const share = minimumsShareOfIncome(state)
  const noExpenses = state.expenses.length === 0

  const daysToCliff = r.incomeEndsOn ? daysUntil(r.incomeEndsOn) : null
  const cliffSoon = daysToCliff !== null && daysToCliff <= 45

  const tone = r.netAfterEnd < 0 ? 'var(--status-critical)' : 'var(--status-good)'

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Runway
        </h2>
        {share !== null && (
          <span className="text-xs" style={{ color: share > 0.4 ? 'var(--status-warning)' : 'var(--text-muted)' }}>
            {Math.round(share * 100)}% of income to minimums
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-1 text-sm">
        <Row label="Income" value={formatCurrency(r.monthlyIncome)} suffix="/mo" />
        <Row
          label={
            r.overdue > 0 ? (
              <>
                Debt due, next 30 days{' '}
                <span style={{ color: 'var(--status-critical)' }}>
                  · incl. {formatCurrency(r.overdue)} past due
                </span>
              </>
            ) : (
              'Debt due, next 30 days'
            )
          }
          value={`− ${formatCurrency(r.monthlyMinimums)}`}
        />
        <Row
          label="Living costs"
          value={noExpenses ? 'not entered' : `− ${formatCurrency(r.monthlyExpenses)}`}
          suffix={noExpenses ? '' : '/mo'}
          muted={noExpenses}
        />
        <div
          className="mt-1 flex items-center justify-between border-t pt-2"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="font-medium">Left over</span>
          <span
            className="tabular-nums font-semibold"
            style={{ color: r.monthlyNet < 0 ? 'var(--status-critical)' : 'var(--status-good)' }}
          >
            {formatCurrency(r.monthlyNet)}/mo
          </span>
        </div>
      </div>

      {r.nextMonthMinimums > 0 && Math.abs(r.nextMonthMinimums - r.monthlyMinimums) > 1 && (
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {formatMonth(r.nextMonthLabel)} is {formatCurrency(r.nextMonthMinimums)} — these plans
          finish at different times, so the figure moves month to month. The calendar has the exact
          dates.
        </p>
      )}

      {/* With nothing coming in there is no cliff ahead — the drawdown is
          already happening, and how long the balance lasts is the whole story.
          This block used to be nested inside the income-ends case, which is
          exactly when it is least needed. */}
      {r.monthlyIncome <= 0 && (
        <div
          className="mt-3 rounded-lg p-3 text-xs"
          style={{ background: 'var(--surface-page)', borderLeft: '3px solid var(--status-critical)' }}
        >
          <p className="font-semibold" style={{ color: 'var(--status-critical)' }}>
            No income coming in
          </p>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            {formatCurrency(r.reserves)} on hand against{' '}
            {formatCurrency(r.monthlyMinimums + r.monthlyExpenses)} due in the next 30 days.
            {r.monthsOfCover !== null && (
              <>
                {' '}
                At the rate the bills actually fall, that lasts{' '}
                <strong style={{ color: 'var(--status-critical)' }}>
                  {coverPhrase(r.monthsOfCover)}
                </strong>
                {r.coveredUntil && <> — to {formatDate(r.coveredUntil)}</>}.
              </>
            )}
          </p>
          <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
            Anything earned goes straight against this. Log gig shifts on the Income tab and the
            figure moves.
          </p>
        </div>
      )}

      {noExpenses && (
        <div className="mt-3 rounded-lg p-2 text-xs" style={{ background: 'var(--surface-page)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            Nothing entered for food, phone or transport, so this figure is still a little
            generous — and so is every split the app suggests.
          </p>
          <button
            type="button"
            onClick={onAddExpenses}
            className="mt-2 rounded-lg px-2 py-1 text-xs font-medium"
            style={{ background: 'var(--cat-installment)', color: 'white' }}
          >
            Add living costs
          </button>
        </div>
      )}

      {r.incomeEndsOn && (
        <div
          className="mt-3 rounded-lg p-3 text-xs"
          style={{ background: 'var(--surface-page)', borderLeft: `3px solid ${tone}` }}
        >
          <p className="font-semibold" style={{ color: tone }}>
            {r.endingSourceName} ends {formatDate(r.incomeEndsOn)}
            {daysToCliff !== null && daysToCliff >= 0 && (
              <> — {daysToCliff === 0 ? 'today' : `${daysToCliff} day${daysToCliff === 1 ? '' : 's'} away`}</>
            )}
            {daysToCliff !== null && daysToCliff < 0 && <> — already passed</>}
          </p>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Income drops to {formatCurrency(r.incomeAfterEnd)}/mo against{' '}
            {formatCurrency(r.monthlyMinimums + r.monthlyExpenses)} of near-term commitments — a{' '}
            <strong style={{ color: tone }}>
              {r.netAfterEnd < 0 ? `${formatCurrency(-r.netAfterEnd)} monthly gap` : 'surplus'}
            </strong>
            .
          </p>
          {r.monthsOfCover !== null && (
            <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
              {formatCurrency(r.reserves)} on hand covers the bills, as they actually fall, for{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {coverPhrase(r.monthsOfCover)}
              </strong>
              {r.coveredUntil && <> — into {formatDate(r.coveredUntil)}</>}.
            </p>
          )}
          {cliffSoon && noExpenses && (
            <p className="mt-1" style={{ color: 'var(--status-warning)' }}>
              With living costs entered the gap will be larger than shown.
            </p>
          )}
        </div>
      )}

      {!r.incomeEndsOn && r.monthlyIncome > 0 && (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          No income source has an end date set. If one runs out — benefits, a contract — set it on
          the Income tab so this card can see it coming.
        </p>
      )}
    </Card>
  )
}

function Row({
  label,
  value,
  suffix,
  muted,
}: {
  label: React.ReactNode
  value: string
  suffix?: string
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="tabular-nums" style={{ color: muted ? 'var(--text-muted)' : undefined }}>
        {value}
        {suffix && <span style={{ color: 'var(--text-muted)' }}>{suffix}</span>}
      </span>
    </div>
  )
}
