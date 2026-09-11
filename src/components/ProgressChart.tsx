import { useMemo, useRef, useState } from 'react'
import type { AppState } from '../types'
import { Card } from './Card'
import { formatCurrency, formatDate } from '../lib/finance'
import { debtHistory, progress, type DebtPoint } from '../lib/history'
import { addDays, formatShortDate, today } from '../lib/schedule'

const W = 320
const H = 120

type RangeKey = '1m' | '3m' | '6m' | 'all'

const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '1m', label: '1M', days: 30 },
  { key: '3m', label: '3M', days: 91 },
  { key: '6m', label: '6M', days: 183 },
  { key: 'all', label: 'All', days: null },
]

/**
 * Debt over time, reconstructed from what has actually been paid.
 *
 * Scrubbable rather than static: the total on its own never looks like
 * progress, and a line without a readout only says "down and to the right".
 * Dragging along it answers what was true on a given day and what happened
 * that day to make it so.
 */
export function ProgressChart({ state }: { state: AppState }) {
  const all = useMemo(() => debtHistory(state), [state])
  const p = useMemo(() => progress(state), [state])

  const [range, setRange] = useState<RangeKey>('all')
  const [selected, setSelected] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const points = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days ?? null
    if (days === null) return all
    const from = addDays(today(), -days)
    const within = all.filter((x) => x.date >= from)
    // Keep the point just before the window so the line enters from the left
    // edge rather than starting mid-air at whatever the first in-range day was.
    const firstIn = all.findIndex((x) => x.date >= from)
    return firstIn > 0 ? [all[firstIn - 1], ...within] : within
  }, [all, range])

  if (all.length < 2) {
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
      x: points.length === 1 ? W / 2 : ((t - first) / width) * W,
      y: H - ((pt.total - lo) / span) * H,
    }
  })

  const line = xy.map((q, i) => `${i === 0 ? 'M' : 'L'}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`
  const milestones = xy.filter((q) => q.cleared.length > 0)

  // Nearest point to wherever the finger is, in viewBox coordinates.
  function pick(clientX: number) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const vx = ((clientX - rect.left) / rect.width) * W
    let best = 0
    for (let i = 1; i < xy.length; i++) {
      if (Math.abs(xy[i].x - vx) < Math.abs(xy[best].x - vx)) best = i
    }
    setSelected(best)
  }

  const active = selected !== null && selected < xy.length ? xy[selected] : null
  const shown: DebtPoint = active ?? points[points.length - 1]
  const isLatest = !active || selected === xy.length - 1

  // Change across whatever is on screen, which is what a range selector is for.
  const windowDrop = points[0].total - points[points.length - 1].total

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Progress
        </h2>
        <span className="text-xs" style={{ color: 'var(--status-good)' }}>
          {formatCurrency(p.paidOff)} paid off · {Math.round(p.fraction * 100)}%
        </span>
      </div>

      <div className="mt-2 flex gap-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => {
              setRange(r.key)
              setSelected(null)
            }}
            className="flex-1 rounded-lg py-1 text-xs font-medium"
            style={{
              background: range === r.key ? 'var(--cat-installment)' : 'var(--surface-page)',
              color: range === r.key ? 'white' : 'var(--text-secondary)',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Readout. Holds the last point until something is picked, so the space
          never collapses and the chart does not jump as you scrub. */}
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {isLatest ? 'Today' : formatDate(shown.date)}
          </div>
          <div className="tabular-nums text-2xl font-semibold">{formatCurrency(shown.total)}</div>
        </div>
        {shown.paid > 0 && (
          <div className="text-right">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              paid that day
            </div>
            <div className="tabular-nums text-sm font-semibold" style={{ color: 'var(--status-good)' }}>
              −{formatCurrency(shown.paid)}
            </div>
          </div>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-2 w-full cursor-crosshair"
        style={{ height: `${H}px`, touchAction: 'none' }}
        role="img"
        aria-label={`Debt fell from ${formatCurrency(p.startedAt)} to ${formatCurrency(p.current)}. Drag to read any day.`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          pick(e.clientX)
        }}
        onPointerMove={(e) => {
          if (e.buttons === 0 && e.pointerType === 'mouse') return
          pick(e.clientX)
        }}
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
        {active && (
          <>
            <line
              x1={active.x}
              y1="0"
              x2={active.x}
              y2={H}
              stroke="var(--text-muted)"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={active.x}
              cy={active.y}
              r="4.5"
              fill="var(--cat-installment)"
              stroke="var(--surface-card)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
        {!active && (
          <circle
            cx={xy[xy.length - 1].x}
            cy={xy[xy.length - 1].y}
            r="3"
            fill="var(--cat-installment)"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      <div className="flex items-baseline justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
        <span>{formatShortDate(points[0].date)}</span>
        <span>
          {windowDrop > 0.005 ? (
            <>
              <span style={{ color: 'var(--status-good)' }}>−{formatCurrency(windowDrop)}</span> over
              this range
            </>
          ) : (
            'no change in this range'
          )}
        </span>
        <span>{formatShortDate(points[points.length - 1].date)}</span>
      </div>

      {/* What happened on the selected day, or the running log when nothing is picked. */}
      {active && active.entries.length > 0 && (
        <div className="mt-3 rounded-lg p-2" style={{ background: 'var(--surface-page)' }}>
          {active.entries.map((e, i) => (
            <div key={i} className="flex items-baseline justify-between gap-2 py-0.5 text-xs">
              <span className="min-w-0 truncate">
                {e.name}
                {e.cleared && <span style={{ color: 'var(--status-good)' }}> · cleared 🎉</span>}
              </span>
              <span className="tabular-nums shrink-0">−{formatCurrency(e.amount)}</span>
            </div>
          ))}
        </div>
      )}

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

      <HistoryLog
        points={all}
        onPick={(date) => {
          // Jump to All so the tapped day is guaranteed to be on screen.
          setRange('all')
          const idx = all.findIndex((x) => x.date === date)
          setSelected(idx >= 0 ? idx : null)
        }}
        selectedDate={active?.date ?? null}
      />
    </Card>
  )
}

/** Every day something came off, newest first. Tapping one selects it on the chart. */
function HistoryLog({
  points,
  onPick,
  selectedDate,
}: {
  points: DebtPoint[]
  onPick: (date: string) => void
  selectedDate: string | null
}) {
  const [open, setOpen] = useState(false)
  const active = points.filter((x) => x.paid > 0).reverse()
  if (active.length === 0) return null

  const shown = open ? active : active.slice(0, 3)

  return (
    <div className="mt-3 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          History
        </span>
        {active.length > 3 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            {open ? 'Show less' : `All ${active.length}`}
          </button>
        )}
      </div>
      <div className="flex flex-col">
        {shown.map((x) => (
          <button
            key={x.date}
            type="button"
            onClick={() => onPick(x.date)}
            className="flex items-baseline justify-between gap-2 rounded-lg px-1.5 py-1.5 text-left text-xs"
            style={{ background: x.date === selectedDate ? 'var(--surface-page)' : 'transparent' }}
          >
            <span className="min-w-0">
              <span className="font-medium">{formatShortDate(x.date)}</span>
              <span className="block truncate" style={{ color: 'var(--text-muted)' }}>
                {x.entries.map((e) => e.name).join(', ')}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="tabular-nums block" style={{ color: 'var(--status-good)' }}>
                −{formatCurrency(x.paid)}
              </span>
              <span className="tabular-nums block" style={{ color: 'var(--text-muted)' }}>
                {formatCurrency(x.total)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
