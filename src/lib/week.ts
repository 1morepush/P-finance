import type { AppState } from '../types'
import { weeklyExpenseObligation } from './finance'
import { WEEKS_PER_MONTH, expenseMonthly } from './budget'
import { summarize } from './gig'
import {
  addDays,
  allPayments,
  billPayments,
  paymentsBetween,
  startOfWeek,
  sumConfirmed,
  sumPotential,
  today,
  weeklyCommitment,
  type ScheduledPayment,
} from './schedule'

export interface WeekTarget {
  /** The Sunday this week starts on. */
  from: string
  /** The Saturday it ends on. */
  to: string
  /** Confirmed debt payments falling anywhere in the Sunday-to-Saturday week. */
  debtDue: number
  /** Subscriptions and bills with a due date that lands in the week. */
  billsDue: number
  /** Of those, the ones still ahead. Equals `billsDue` for a future week. */
  billsRemaining: number
  /** Everything due on a day in the week — debt payments and dated bills — soonest first. */
  items: ScheduledPayment[]
  /** Of that, what is still ahead — the part of the week that has not happened. */
  debtRemaining: number
  itemsRemaining: ScheduledPayment[]
  /** Confirmed debt already due earlier in this week. Zero for a future week. */
  debtPassed: number
  /** True once the week is underway, so a partial figure can be labelled as one. */
  partial: boolean
  /** Unconfirmed payments in the same window, kept separate. */
  potentialDue: number
  /**
   * This week's share of the living costs that have no set day — groceries,
   * gas. Costs with a due date are not averaged in here; they are counted on
   * their day, in `billsDue`.
   */
  livingCosts: number
  /** What the whole week costs: debt and bills due across it, plus living costs. */
  total: number
  /** What is left to cover before Saturday. Equals `total` for a future week. */
  remaining: number
  /**
   * The mean of the four weeks on screen. Shown alongside so a heavy week is
   * recognisable as heavy rather than taken as the new normal.
   */
  averageWeek: number
  /** Positive when this week costs more than an average one. */
  vsAverage: number
  /** Net per hour across every logged shift, when hours have been recorded. */
  netPerHour: number | null
  /** Hours of gig work the week's remaining bill works out to at that rate. */
  hoursNeeded: number | null
}

/**
 * What a specific week costs, from real due dates rather than a monthly average.
 *
 * Weeks run Sunday to Saturday — the calendar week, not seven days counted from
 * whenever you happened to open the app. A window that slides with today makes
 * two readings a day apart cover different sets of bills, which is no basis for
 * "what do I need to make this week".
 *
 * The current week reports both: the whole week's bill, so the four bars are
 * comparable, and what is still ahead, which is the part you can act on.
 */
export function weekTarget(state: AppState, now = today(), weeksAhead = 0): WeekTarget {
  const from = addDays(startOfWeek(now), weeksAhead * 7)
  const to = addDays(from, 6)

  const all = allPayments(state.debts, true)
  const window = paymentsBetween(all, from, to)
  const debtDue = sumConfirmed(window)
  const potentialDue = sumPotential(window)

  // Subscriptions land on their own days, like a debt payment would. Spread
  // evenly they made a week holding Claude and iCloud look the same as one
  // holding neither, and never showed up in the week's list.
  const bills = billPayments(state.expenses, from, to)
  const billsDue = bills.reduce((n, b) => n + b.amount, 0)

  // Only the current week can be partly spent; a past-dated payment can still
  // sit here when a debt is flagged as paid by hand rather than autopay.
  const partial = now > from && now <= to
  const ahead = partial ? paymentsBetween(window, now, to) : window
  const billsAhead = partial ? bills.filter((b) => b.date >= now) : bills
  const debtRemaining = sumConfirmed(ahead)
  const billsRemaining = billsAhead.reduce((n, b) => n + b.amount, 0)

  // Only costs without a day are spread across the week.
  const undated = state.expenses.filter((e) => !e.nextDue)
  const livingCosts = undated.reduce((n, e) => n + expenseMonthly(e), 0) / WEEKS_PER_MONTH
  const total = debtDue + billsDue + livingCosts
  const remaining = debtRemaining + billsRemaining + livingCosts

  // The yardstick stays an average of everything, dated or not, so a week
  // with a bill in it reads as heavier than usual rather than as the norm.
  // Anchored on this week's Sunday so the weeks it averages are the ones drawn.
  const averageWeek = weeklyCommitment(state.debts, startOfWeek(now)) + weeklyExpenseObligation(state)
  const { netPerHour } = summarize(state.shifts)

  return {
    from,
    to,
    debtDue,
    billsDue,
    billsRemaining,
    items: [...window.filter((p) => !p.isPotential), ...bills].sort((a, b) => a.date.localeCompare(b.date)),
    debtRemaining,
    itemsRemaining: [...ahead.filter((p) => !p.isPotential), ...billsAhead].sort((a, b) => a.date.localeCompare(b.date)),
    debtPassed: debtDue - debtRemaining + (billsDue - billsRemaining),
    partial,
    potentialDue,
    livingCosts,
    total,
    remaining,
    averageWeek,
    vsAverage: total - averageWeek,
    netPerHour: netPerHour && netPerHour > 0 ? netPerHour : null,
    hoursNeeded: netPerHour && netPerHour > 0 ? remaining / netPerHour : null,
  }
}

/** This week and the next few, so a heavy one is visible before it arrives. */
export function upcomingWeeks(state: AppState, count = 4, now = today()): WeekTarget[] {
  return Array.from({ length: count }, (_, i) => weekTarget(state, now, i))
}
