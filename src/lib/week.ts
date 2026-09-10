import type { AppState } from '../types'
import { weeklyExpenseObligation } from './finance'
import { summarize } from './gig'
import {
  addDays,
  allPayments,
  paymentsBetween,
  sumConfirmed,
  sumPotential,
  today,
  weeklyCommitment,
  type ScheduledPayment,
} from './schedule'

export interface WeekTarget {
  from: string
  to: string
  /** Confirmed debt payments actually falling in this seven-day window. */
  debtDue: number
  items: ScheduledPayment[]
  /** Unconfirmed payments in the same window, kept separate. */
  potentialDue: number
  /** This week's share of recurring living costs. */
  livingCosts: number
  /** What the week costs: debt actually due plus living costs. */
  total: number
  /**
   * The smoothed figure — monthly commitments spread evenly. Shown alongside so
   * a heavy week is recognisable as heavy rather than taken as the new normal.
   */
  averageWeek: number
  /** Positive when this week costs more than an average one. */
  vsAverage: number
  /** Net per hour across every logged shift, when hours have been recorded. */
  netPerHour: number | null
  /** Hours of gig work the week's bill works out to at that rate. */
  hoursNeeded: number | null
}

/**
 * What a specific week actually costs, from real due dates rather than a monthly
 * average. The average answers "what do I owe per week on paper"; this answers
 * "what do I need to make before Sunday", which is the question worth asking
 * when three plans happen to bill on the same Friday.
 */
export function weekTarget(state: AppState, now = today(), weeksAhead = 0): WeekTarget {
  const from = addDays(now, weeksAhead * 7)
  const to = addDays(from, 6)

  const window = paymentsBetween(allPayments(state.debts, true), from, to)
  const debtDue = sumConfirmed(window)
  const potentialDue = sumPotential(window)
  const livingCosts = weeklyExpenseObligation(state)
  const total = debtDue + livingCosts

  const averageWeek = weeklyCommitment(state.debts, now) + livingCosts
  const { netPerHour } = summarize(state.shifts)

  return {
    from,
    to,
    debtDue,
    items: window.filter((p) => !p.isPotential),
    potentialDue,
    livingCosts,
    total,
    averageWeek,
    vsAverage: total - averageWeek,
    netPerHour: netPerHour && netPerHour > 0 ? netPerHour : null,
    hoursNeeded: netPerHour && netPerHour > 0 ? total / netPerHour : null,
  }
}

/** This week and the next few, so a heavy one is visible before it arrives. */
export function upcomingWeeks(state: AppState, count = 4, now = today()): WeekTarget[] {
  return Array.from({ length: count }, (_, i) => weekTarget(state, now, i))
}
