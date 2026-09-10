import { categoryOfProduct } from '../types'
import { formatCurrency } from '../lib/finance'
import { formatMonth, nextMonth, type ScheduledPayment } from '../lib/schedule'

const CATEGORY_COLOR = {
  installment: 'var(--cat-installment)',
  revolving: 'var(--cat-revolving)',
  personal: 'var(--cat-personal)',
} as const

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** The YYYY-MM before the given one. */
export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7)
}

/**
 * Lays a month out as weeks of ISO dates, padded with nulls so the 1st lands on
 * its real weekday. Weeks start Sunday.
 */
function buildWeeks(month: string): (string | null)[][] {
  const [y, m] = month.split('-').map(Number)
  const leading = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()

  const cells: (string | null)[] = Array(leading).fill(null)
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export function MonthGrid({
  month,
  payments,
  today,
  selected,
  onSelect,
  onMonthChange,
  onPay,
}: {
  month: string
  payments: ScheduledPayment[]
  today: string
  selected: string | null
  onSelect: (date: string | null) => void
  onMonthChange: (month: string) => void
  /** Logs one scheduled payment as made. Omitted where the grid is read-only. */
  onPay?: (payment: ScheduledPayment) => void
}) {
  const weeks = buildWeeks(month)
  const byDate = new Map<string, ScheduledPayment[]>()
  for (const p of payments) {
    if (!byDate.has(p.date)) byDate.set(p.date, [])
    byDate.get(p.date)!.push(p)
  }

  const monthTotal = payments
    .filter((p) => p.date.startsWith(month) && !p.isPotential)
    .reduce((s, p) => s + p.amount, 0)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onMonthChange(previousMonth(month))}
          aria-label="Previous month"
          className="rounded-lg px-2 py-1 text-sm"
          style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}
        >
          ‹
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold">{formatMonth(month)}</div>
          <div className="tabular-nums text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {formatCurrency(monthTotal)} due
          </div>
        </div>
        <button
          type="button"
          onClick={() => onMonthChange(nextMonth(month))}
          aria-label="Next month"
          className="rounded-lg px-2 py-1 text-sm"
          style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d, i) => (
          <div
            key={i}
            className="pb-1 text-center text-[10px] font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            {d}
          </div>
        ))}

        {weeks.flat().map((date, i) => {
          if (!date) return <div key={`pad-${i}`} />

          const items = byDate.get(date) ?? []
          const total = items.reduce((s, p) => s + p.amount, 0)
          const isToday = date === today
          const isSelected = date === selected
          const isPast = date < today
          const hasPayments = items.length > 0

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(isSelected ? null : date)}
              className="flex min-h-[46px] flex-col items-center rounded-lg px-0.5 pt-1 pb-0.5"
              style={{
                background: isSelected
                  ? 'var(--cat-installment)'
                  : hasPayments
                    ? 'var(--surface-page)'
                    : 'transparent',
                // Today keeps a ring so it stays findable even when another day is open.
                outline: isToday ? '1.5px solid var(--status-good)' : 'none',
                outlineOffset: '-1.5px',
                opacity: isPast && !hasPayments ? 0.35 : 1,
              }}
            >
              <span
                className="tabular-nums text-[11px] leading-none"
                style={{
                  color: isSelected
                    ? 'white'
                    : isToday
                      ? 'var(--status-good)'
                      : 'var(--text-primary)',
                  fontWeight: isToday || hasPayments ? 600 : 400,
                }}
              >
                {Number(date.slice(8))}
              </span>

              {hasPayments && (
                <>
                  <span
                    className="tabular-nums mt-0.5 text-[9px] leading-none"
                    style={{ color: isSelected ? 'white' : 'var(--text-secondary)' }}
                  >
                    ${Math.round(total)}
                  </span>
                  <span className="mt-1 flex gap-[2px]">
                    {items.slice(0, 4).map((p, j) => (
                      <span
                        key={j}
                        className="inline-block h-[3px] w-[3px] rounded-full"
                        style={{
                          background: p.isPotential
                            ? 'var(--status-warning)'
                            : CATEGORY_COLOR[categoryOfProduct(p.product)],
                        }}
                      />
                    ))}
                  </span>
                </>
              )}
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="mt-3 rounded-lg p-2" style={{ background: 'var(--surface-page)' }}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold">
              {new Date(`${selected}T00:00:00`).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <span className="tabular-nums text-xs">
              {formatCurrency((byDate.get(selected) ?? []).reduce((s, p) => s + p.amount, 0))}
            </span>
          </div>
          {(byDate.get(selected) ?? []).length === 0 ? (
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Nothing due.
            </p>
          ) : (
            (byDate.get(selected) ?? []).map((p, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 text-[11px]">
                <span className="min-w-0 truncate">
                  {p.debtName}
                  {p.isPotential && (
                    <span style={{ color: 'var(--status-warning)' }}> · unconfirmed</span>
                  )}
                  {p.isFinal && !p.isPotential && (
                    <span style={{ color: 'var(--status-good)' }}> · final 🎉</span>
                  )}
                </span>
                <span className="tabular-nums shrink-0">{formatCurrency(p.amount)}</span>
                {onPay && !p.isPotential && (
                  <button
                    type="button"
                    onClick={() => onPay(p)}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: 'var(--status-good)', color: 'white' }}
                  >
                    Pay
                  </button>
                )}
              </div>
            ))
          )}
          {onPay && (byDate.get(selected) ?? []).filter((p) => !p.isPotential).length > 1 && (
            <button
              type="button"
              onClick={() => (byDate.get(selected) ?? []).filter((p) => !p.isPotential).forEach(onPay)}
              className="mt-2 w-full rounded-lg py-1.5 text-[11px] font-medium"
              style={{ background: 'var(--status-good)', color: 'white' }}
            >
              Mark all{' '}
              {(byDate.get(selected) ?? []).filter((p) => !p.isPotential).length} paid —{' '}
              {formatCurrency(
                (byDate.get(selected) ?? [])
                  .filter((p) => !p.isPotential)
                  .reduce((s, p) => s + p.amount, 0),
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
