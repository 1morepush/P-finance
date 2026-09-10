import type { AppState } from '../types'
import { Card } from './Card'
import { formatCurrency } from '../lib/finance'
import { debtHistory, progress } from '../lib/history'
import { formatShortDate } from '../lib/schedule'

const W = 320
const H = 90

/**
 * Debt over time, reconstructed from what has actually been paid.
 *
 * The total on its own never looks like progress — it is large, and it stays
 * large for a long time. The slope is the part worth seeing.
 */
export function ProgressChart({ state }: { state: AppState }) {
  const points = debtHistory(state)
  const p = progress(state)

  if (points.length < 2) {
    return (
      <Card>
        <h2 className="mb-1 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Progress
        </h2>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Nothing logged yet. Once payments are recorded this charts the total coming down.
        </p>
      </Card>
    )
  }

  const max = Math.max(...points.map((x) => x.total))
  const min = Math.min(...points.map((x) => x.total))
  // A floor of zero would flatten the line; padding the range keeps the slope readable.
  const lo = Math.max(min - (max - min) * 0.15, 0)
  const span = Math.max(max - lo, 1)

  const first = new Date(`${points[0].date}T00:00:00Z`).getTime()
  const last = new Date(`${points[points.length - 1].date}T00:00:00Z`).getTime()
  const width = Math.max(last - first, 1)

  const xy = points.map((pt) => {
    const t = new Date(`${pt.date}T00:00:00Z`).getTime()
    return {
      ...pt,
      x: ((t - first) / width) * W,
      y: H - ((pt.total - lo) / span) * H,
    }
  })

  const line = xy.map((q, i) => `${i === 0 ? 'M' : 'L'}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`
  const milestones = xy.filter((q) => q.cleared.length > 0)

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Progress
        </h2>
        <span className="text-xs" style={{ color: 'var(--status-good)' }}>
          {formatCurrency(p.paidOff)} paid off · {Math.round(p.fraction * 100)}%
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-2 h-[90px] w-full"
        role="img"
        aria-label={`Debt fell from ${formatCurrency(p.startedAt)} to ${formatCurrency(p.current)}`}
      >
        <defs>
          <linearGradient id="pf-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--cat-installment)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--cat-installment)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#pf-fade)" />
        <path
          d={line}
          fill="none"
          stroke="var(--cat-installment)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* A debt finishing is the part worth marking. */}
        {milestones.map((q) => (
          <circle
            key={q.date}
            cx={q.x}
            cy={q.y}
            r="3"
            fill="var(--status-good)"
            stroke="var(--surface-card)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <circle
          cx={xy[xy.length - 1].x}
          cy={xy[xy.length - 1].y}
          r="3"
          fill="var(--cat-installment)"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="flex items-baseline justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
        <span>
          {formatShortDate(points[0].date)} · {formatCurrency(p.startedAt)}
        </span>
        <span>
          today · <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(p.current)}</strong>
        </span>
      </div>

      <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {formatCurrency(p.perMonth)} a month off the total over the last{' '}
        {p.days < 60 ? `${p.days} days` : `${Math.round(p.days / 30.44)} months`}
        {p.monthsToZero !== null && (
          <>
            {' '}
            — debt free in about{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {p.monthsToZero < 24
                ? `${Math.round(p.monthsToZero)} months`
                : `${(p.monthsToZero / 12).toFixed(1)} years`}
            </strong>{' '}
            at that rate.
          </>
        )}
      </p>

      {milestones.length > 0 && (
        <p className="mt-1 text-[11px]" style={{ color: 'var(--status-good)' }}>
          ● {milestones.flatMap((q) => q.cleared).length} cleared:{' '}
          {milestones.flatMap((q) => q.cleared).slice(-3).join(', ')}
          {milestones.flatMap((q) => q.cleared).length > 3 && ' …'}
        </p>
      )}
    </Card>
  )
}
