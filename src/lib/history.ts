import type { AppState } from '../types'
import { totalDebt } from './finance'
import { addDays, today } from './schedule'

export interface DebtPoint {
  date: string
  /** Total active debt outstanding on that date. */
  total: number
  /** What came off on that date. */
  paid: number
  /** Debts that finished on that date. */
  cleared: string[]
}

/**
 * Reconstructs the debt total backwards from today.
 *
 * There are no balance snapshots to plot, but every reduction is recorded — as
 * a logged payment, or as an entry in the cleared log for the ones settled
 * before the app existed. Today's total plus everything paid since date T is
 * what was outstanding at T.
 *
 * A payment that zeroed a debt appears in both places (the final payment and
 * the cleared entry are the same money), so cleared debts are only counted when
 * no logged payment claims them.
 */
export function debtHistory(state: AppState, now = today()): DebtPoint[] {
  const current = totalDebt(state.debts)

  const clearedByPayment = new Set(
    state.payments.filter((p) => p.clearedDebt).map((p) => p.debtId),
  )

  type Event = { date: string; amount: number; cleared?: string }
  const events: Event[] = [
    ...state.payments.map((p) => ({
      date: p.date,
      amount: p.amount,
      cleared: p.clearedDebt ? p.debtName : undefined,
    })),
    ...state.clearedDebts
      .filter((c) => !clearedByPayment.has(c.id))
      .map((c) => ({ date: c.dateCleared, amount: c.amountCleared, cleared: c.name })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  if (events.length === 0) return [{ date: now, total: current, paid: 0, cleared: [] }]

  // Everything paid, added back on, is where the line starts. Dated the day
  // before the first payment: on the day itself the total is already lower, and
  // anchoring the start there would hide the very first reduction.
  let running = current + events.reduce((s, e) => s + e.amount, 0)

  const points: DebtPoint[] = [
    { date: addDays(events[0].date, -1), total: running, paid: 0, cleared: [] },
  ]

  for (const e of events) {
    running -= e.amount
    const last = points[points.length - 1]
    // One point per date, however many payments landed on it.
    if (last.date === e.date && last.paid > 0) {
      last.total = running
      last.paid += e.amount
      if (e.cleared) last.cleared.push(e.cleared)
    } else if (last.date === e.date) {
      last.total = running
      last.paid = e.amount
      if (e.cleared) last.cleared.push(e.cleared)
    } else {
      points.push({
        date: e.date,
        total: running,
        paid: e.amount,
        cleared: e.cleared ? [e.cleared] : [],
      })
    }
  }

  const last = points[points.length - 1]
  if (last.date !== now) points.push({ date: now, total: current, paid: 0, cleared: [] })

  return points
}

export interface Progress {
  /** Where the line started — the earliest reconstructable total. */
  startedAt: number
  current: number
  paidOff: number
  /** Share of the starting total that has been retired. */
  fraction: number
  /** Average monthly reduction since the first recorded event. */
  perMonth: number
  /** Months to zero at that rate, or null when nothing is coming off. */
  monthsToZero: number | null
  firstDate: string | null
  days: number
}

export function progress(state: AppState, now = today()): Progress {
  const points = debtHistory(state, now)
  const startedAt = points[0].total
  const current = totalDebt(state.debts)
  const paidOff = Math.max(startedAt - current, 0)

  const firstDate = points.length > 1 ? points[0].date : null
  const days = firstDate
    ? Math.max(
        Math.round(
          (new Date(`${now}T00:00:00Z`).getTime() - new Date(`${firstDate}T00:00:00Z`).getTime()) /
            86400000,
        ),
        1,
      )
    : 0

  const perMonth = days > 0 ? (paidOff / days) * 30.44 : 0

  return {
    startedAt,
    current,
    paidOff,
    fraction: startedAt > 0 ? paidOff / startedAt : 0,
    perMonth,
    monthsToZero: perMonth > 0.01 ? current / perMonth : null,
    firstDate,
    days,
  }
}
