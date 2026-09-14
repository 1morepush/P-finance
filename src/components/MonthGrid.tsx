import { formatCurrency } from '../lib/finance'
import { formatMonth, nextMonth } from '../lib/schedule'
import { entriesOn, monthTotals, sumEntries, type CalendarEntry } from '../lib/calendar'

const CATEGORY_COLOR = {
  installment: 'var(--cat-installment)',
  revolving: 'var(--cat-revolving)',
  personal: 'var(--cat-personal)',
} as const

/** Settled money reads as one colour whatever it was owed on. */
const PAID_COLOR = 'var(--status-good)'

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
  entries,
  today,
  selected,
  onSelect,
  onMonthChange,
  onPay,
  onUndo,
}: {
  month: string
  /** Paid and due together — see ../lib/calendar. */
  entries: CalendarEntry[]
  today: string
  selected: string | null
  onSelect: (date: string | null) => void
  onMonthChange: (month: string) => void
  /** Logs one scheduled payment as made. Omitted where the grid is read-only. */
  onPay?: (entry: CalendarEntry) => void
  /** Reverses a logged payment. Omitted where the grid is read-only. */
  onUndo?: (paymentId: string) => void
}) {
  const weeks = buildWeeks(month)
  const byDate = new Map<string, CalendarEntry[]>()
  for (const e of entries) {
    if (!byDate.has(e.date)) byDate.set(e.date, [])
    byDate.get(e.date)!.push(e)
  }

  const totals = monthTotals(entries, month)
  const selectedItems = selected ? entriesOn(entries, selected) : []
  const payable = selectedItems.filter((e) => e.kind === 'due' && !e.isPotential)

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
          {/* A past month has nothing due, a future one nothing paid, and the
              current month has both — so say which is which rather than
              printing one figure that means different things by month. */}
          <div className="tabular-nums text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {totals.paid > 0 && (
              <span style={{ color: PAID_COLOR }}>{formatCurrency(totals.paid)} paid</span>
            )}
            {totals.paid > 0 && totals.due > 0 && ' · '}
            {totals.due > 0 && <span>{formatCurrency(totals.due)} due</span>}
            {totals.paid === 0 && totals.due === 0 && 'Nothing this month'}
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
          const total = sumEntries(items)
          const isToday = date === today
          const isSelected = date === selected
          const isPast = date < today
          const has = items.length > 0
          // A past day carrying only settled payments is history, not a bill.
          const settled = has && items.every((e) => e.kind === 'paid')

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(isSelected ? null : date)}
              className="flex min-h-[46px] flex-col items-center rounded-lg px-0.5 pt-1 pb-0.5"
              style={{
                background: isSelected
                  ? 'var(--cat-installment)'
                  : has
                    ? 'var(--surface-page)'
                    : 'transparent',
                // Today keeps a ring so it stays findable even when another day is open.
                outline: isToday ? '1.5px solid var(--status-good)' : 'none',
                outlineOffset: '-1.5px',
                opacity: isPast && !has ? 0.35 : 1,
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
                  fontWeight: isToday || has ? 600 : 400,
                }}
              >
                {Number(date.slice(8))}
              </span>

              {has && (
                <>
                  <span
                    className="tabular-nums mt-0.5 text-[9px] leading-none"
                    style={{
                      color: isSelected
                        ? 'white'
                        : settled
                          ? 'var(--text-muted)'
                          : 'var(--text-secondary)',
                    }}
                  >
                    {settled && '✓'}${Math.round(total)}
                  </span>
                  <span className="mt-1 flex gap-[2px]">
                    {items.slice(0, 4).map((e) => (
                      <span
                        key={e.key}
                        className="inline-block h-[3px] w-[3px] rounded-full"
                        style={{
                          background:
                            e.kind === 'paid'
                              ? PAID_COLOR
                              : e.isPotential
                                ? 'var(--status-warning)'
                                : CATEGORY_COLOR[e.category],
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
              {formatCurrency(sumEntries(selectedItems))}
            </span>
          </div>

          {selectedItems.length === 0 ? (
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {selected < today ? 'Nothing paid or due.' : 'Nothing due.'}
            </p>
          ) : (
            selectedItems.map((e) => (
              <div key={e.key} className="flex items-baseline justify-between gap-2 text-[11px]">
                <span
                  className="min-w-0 flex-1 truncate"
                  style={{ color: e.kind === 'paid' ? 'var(--text-secondary)' : undefined }}
                >
                  {e.kind === 'paid' && <span style={{ color: PAID_COLOR }}>✓ </span>}
                  {e.debtName}
                  {e.kind === 'paid' && e.isFinal && (
                    <span style={{ color: PAID_COLOR }}> · paid off 🎉</span>
                  )}
                  {e.kind === 'paid' && !e.isFinal && e.auto && (
                    <span style={{ color: 'var(--text-muted)' }}> · autopay</span>
                  )}
                  {e.isPotential && (
                    <span style={{ color: 'var(--status-warning)' }}> · unconfirmed</span>
                  )}
                  {e.kind === 'due' && e.isFinal && !e.isPotential && (
                    <span style={{ color: 'var(--status-good)' }}> · final 🎉</span>
                  )}
                </span>
                <span className="tabular-nums shrink-0">{formatCurrency(e.amount)}</span>
                {onPay && e.kind === 'due' && !e.isPotential && (
                  <button
                    type="button"
                    onClick={() => onPay(e)}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: 'var(--status-good)', color: 'white' }}
                  >
                    Pay
                  </button>
                )}
                {/* Autopay settles these without asking, so the place to correct
                    one that did not actually go through is where it is seen. */}
                {onUndo && e.paymentId && (
                  <button
                    type="button"
                    onClick={() => onUndo(e.paymentId!)}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px]"
                    style={{ background: 'var(--surface-card)', color: 'var(--text-muted)' }}
                  >
                    Undo
                  </button>
                )}
              </div>
            ))
          )}

          {onPay && payable.length > 1 && (
            <button
              type="button"
              onClick={() => payable.forEach(onPay)}
              className="mt-2 w-full rounded-lg py-1.5 text-[11px] font-medium"
              style={{ background: 'var(--status-good)', color: 'white' }}
            >
              Mark all {payable.length} paid — {formatCurrency(sumEntries(payable))}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
