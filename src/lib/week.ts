import type { AppState } from '../types'
import { weeklyExpenseObligation } from './finance'
import { summarize } from './gig'
import {
  addDays,
  allPayments,
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
  /** This week's share of recurring living costs. */
  livingCosts: number
  /** What the whole week costs: debt due across it plus living costs. */
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

  // Only the current week can be partly spent; a past-dated payment can still
  // sit here when a debt is flagged as paid by hand rather than autopay.
  const partial = now > from && now <= to
  const ahead = partial ? paymentsBetween(window, now, to) : window
  const debtRemaining = sumConfirmed(ahead)

  const livingCosts = weeklyExpenseObligation(state)
  const total = debtDue + livingCosts
  const remaining = debtRemaining + livingCosts

  // Anchored on this week's Sunday so the four weeks it averages are exactly
  // the four the strip draws.
  const averageWeek = weeklyCommitment(state.debts, startOfWeek(now)) + livingCosts
  const { netPerHour } = summarize(state.shifts)

  return {
    from,
    to,
    debtDue,
    items: window.filter((p) => !p.isPotential),
    debtRemaining,
    itemsRemaining: ahead.filter((p) => !p.isPotential),
    debtPassed: debtDue - debtRemaining,
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
