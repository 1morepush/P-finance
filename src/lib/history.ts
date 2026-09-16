import type { AppState } from '../types'
import { totalDebt } from './finance'
import { addDays, daysUntil, today } from './schedule'

/** One reduction on a given day — which debt, how much, and whether it finished it. */
export interface DebtEntry {
  name: string
  amount: number
  cleared: boolean
  /** Written off rather than paid: off the total, but no cash left the account. */
  forgiven: boolean
}

export interface DebtPoint {
  date: string
  /** Total active debt outstanding on that date. */
  total: number
  /** What came off on that date, forgiveness included. */
  paid: number
  /** Of that, what was actually paid — the figure a payoff rate is made of. */
  cash: number
  /** Every reduction recorded that day, so a selected point can explain itself. */
  entries: DebtEntry[]
  /** Debts that finished on that date. */
  cleared: string[]
  /** True when the total is a recorded snapshot rather than a reconstruction. */
  observed: boolean
}

interface Event {
  date: string
  amount: number
  name: string
  cleared: boolean
  forgiven: boolean
}

function collectEvents(state: AppState): Event[] {
  // A payment that zeroed a debt appears in both places (the final payment and
  // the cleared entry are the same money), so cleared debts are only counted
  // when no logged payment claims them.
  const clearedByPayment = new Set(state.payments.filter((p) => p.clearedDebt).map((p) => p.debtId))
  return [
    ...state.payments.map((p) => ({
      date: p.date,
      amount: p.amount,
      name: p.debtName,
      cleared: p.clearedDebt,
      forgiven: false,
    })),
    ...state.clearedDebts
      .filter((c) => !clearedByPayment.has(c.id))
      .map((c) => ({
        date: c.dateCleared,
        amount: c.amountCleared,
        name: c.name,
        cleared: true,
        forgiven: c.forgiven === true,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date))
}

function blank(date: string, total: number, observed: boolean): DebtPoint {
  return { date, total, paid: 0, cash: 0, entries: [], cleared: [], observed }
}

function absorb(point: DebtPoint, e: Event) {
  point.paid += e.amount
  if (!e.forgiven) point.cash += e.amount
  point.entries.push({ name: e.name, amount: e.amount, cleared: e.cleared, forgiven: e.forgiven })
  if (e.cleared) point.cleared.push(e.name)
}

/**
 * Walks events forward from a known total, one point per date. Used for the
 * stretch before any snapshot exists, where the only record is what was paid.
 */
function reconstruct(events: Event[], endTotal: number): DebtPoint[] {
  if (events.length === 0) return []
  // Everything paid, added back on, is where the line starts. Dated the day
  // before the first payment: on the day itself the total is already lower, and
  // anchoring the start there would hide the very first reduction.
  let running = endTotal + events.reduce((s, e) => s + e.amount, 0)
  const points: DebtPoint[] = [blank(addDays(events[0].date, -1), running, false)]
  for (const e of events) {
    running -= e.amount
    const last = points[points.length - 1]
    if (last.date === e.date) {
      last.total = running
      absorb(last, e)
    } else {
      const p = blank(e.date, running, false)
      absorb(p, e)
      points.push(p)
    }
  }
  return points
}

/**
 * Debt over time.
 *
 * Where a daily snapshot exists the total is the snapshot — what was actually
 * on screen that day. Reconstructing backwards from the payment log is only
 * used for the stretch before the first snapshot, because the log is exactly
 * the thing a duplicated record inflates and a hand-corrected balance never
 * reaches; the total on screen was right through both.
 *
 * Event days after the first snapshot that have no snapshot of their own — an
 * autopay date settled on a later open — are stepped down from the last
 * observed total, and the next snapshot corrects any drift.
 */
export function debtHistory(state: AppState, now = today()): DebtPoint[] {
  const current = totalDebt(state.debts)
  const events = collectEvents(state)
  const snapshots = [...state.snapshots].sort((a, b) => a.date.localeCompare(b.date))

  let points: DebtPoint[]

  if (snapshots.length === 0) {
    points = reconstruct(events, current)
    if (points.length === 0) return [blank(now, current, false)]
  } else {
    const first = snapshots[0]
    const before = events.filter((e) => e.date < first.date)
    const after = events.filter((e) => e.date >= first.date)
    // A snapshot is the total at the end of its day, after that day's payments.
    // The reconstruction runs up to the start of that day, so it anchors on the
    // total before those payments came off.
    const paidOnFirstDay = after
      .filter((e) => e.date === first.date)
      .reduce((s, e) => s + e.amount, 0)
    points = reconstruct(before, first.total + paidOnFirstDay)

    const byDate = new Map<string, DebtPoint>()
    for (const s of snapshots) byDate.set(s.date, blank(s.date, s.total, true))
    for (const e of after) {
      if (!byDate.has(e.date)) byDate.set(e.date, blank(e.date, 0, false))
      absorb(byDate.get(e.date)!, e)
    }
    const dates = [...byDate.keys()].sort()
    let running = first.total
    for (const d of dates) {
      const p = byDate.get(d)!
      if (p.observed) running = p.total
      else {
        running -= p.paid
        p.total = running
      }
      points.push(p)
    }
  }

  // The closing point sits at whichever is later: today, or the last recorded
  // day. A payment dated ahead of today is already reflected in the balance,
  // so anchoring the end at `now` would put it left of a point it comes after
  // and the line would double back on itself.
  const last = points[points.length - 1]
  const endDate = last.date > now ? last.date : now
  if (last.date !== endDate) points.push(blank(endDate, current, false))
  else if (!last.observed) last.total = current

  return points
}

/** Days the payoff rate is measured over. Long enough to smooth a fortnight, short enough to be current. */
export const RATE_WINDOW_DAYS = 30

export interface Progress {
  /** Where the line started — the earliest reconstructable total. */
  startedAt: number
  current: number
  /** Everything that has come off the total, forgiveness included. */
  paidOff: number
  /** Of that, what was written off rather than paid. */
  forgiven: number
  /** Share of the starting total that has been retired. */
  fraction: number
  /** Cash actually paid over the rate window, scaled to a month. */
  perMonth: number
  /** Days the rate is measured over — the window, or less when there is less history. */
  rateDays: number
  /** Cash paid within that window. */
  cashInWindow: number
  /** Months to zero at that rate, or null when nothing is coming off. */
  monthsToZero: number | null
  firstDate: string | null
  days: number
}

/**
 * The rate is a trailing window of cash actually paid, not the whole history
 * averaged. Averaging from the first day counted a month of lump payoffs made
 * before the app existed — one of them forgiven, not paid — and announced
 * "debt free in 8 months" to someone with no income.
 */
export function progress(state: AppState, now = today()): Progress {
  const points = debtHistory(state, now)
  const startedAt = points[0].total
  const current = totalDebt(state.debts)
  const paidOff = Math.max(startedAt - current, 0)
  const forgiven = points.reduce((s, p) => s + (p.paid - p.cash), 0)

  const firstDate = points.length > 1 ? points[0].date : null
  const days = firstDate ? Math.max(-daysUntil(firstDate, now), 1) : 0

  const rateDays = Math.max(Math.min(RATE_WINDOW_DAYS, days), 1)
  const from = addDays(now, -(rateDays - 1))
  const cashInWindow = points
    .filter((p) => p.date >= from && p.date <= now)
    .reduce((s, p) => s + p.cash, 0)
  const perMonth = days > 0 ? (cashInWindow / rateDays) * 30.44 : 0

  return {
    startedAt,
    current,
    paidOff,
    forgiven,
    fraction: startedAt > 0 ? paidOff / startedAt : 0,
    perMonth,
    rateDays,
    cashInWindow,
    monthsToZero: perMonth > 0.01 ? current / perMonth : null,
    firstDate,
    days,
  }
}
