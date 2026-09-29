import type { AppState, Debt, PaycheckInputs, Shift } from '../types'
export type { PlanInputs } from '../types'
import { MILEAGE_RATE } from './gig'
import { CHECKS_PER_YEAR, estimatePaycheck, FEDERAL_STANDARD_DEDUCTION, marginalRate, NC_RATE } from './paycheck'
import { splitLeftover } from './split'
import { upcomingWeeks } from './week'
import type { ScheduledPayment } from './schedule'
import { today } from './schedule'

/**
 * Where a paycheck goes, and — when it falls short — how much DoorDash or
 * Depop it takes to close the gap.
 *
 * It answers for a window: this Sunday-to-Saturday week, or the next four.
 * The bills are the same ones the Dashboard's week strip counts — real due
 * dates plus living costs — so the two screens cannot disagree about what a
 * week costs.
 */

export type PlanWindow = 'week' | 'fourWeeks'

/**
 * Self-employment tax: 15.3% on 92.35% of profit. DoorDash withholds nothing,
 * so this is owed in April on every dollar of profit.
 */
export const SELF_EMPLOYMENT_RATE = 0.9235 * 0.153
/**
 * The 20% qualified business income deduction takes a fifth off the federal
 * income tax on gig profit. NC does not allow it.
 */
const QBI_SHARE = 0.8

/** Depop, US, 2026: no selling fee, 3.3% + $0.45 payment processing per sale. */
export const DEPOP_PROCESSING_RATE = 0.033
export const DEPOP_PROCESSING_FLAT = 0.45

export interface DashRate {
  /** After gas, before tax — what the shift log calls net. */
  perHour: number
  /** Set aside for April out of each hour. */
  taxPerHour: number
  /** What an hour is really worth to the plan. */
  keepPerHour: number
  /** Where the hourly figure came from. */
  source: 'logged' | 'entered'
  /** Hours the logged figure rests on. */
  hoursLogged: number
}

export interface Plan {
  window: PlanWindow
  from: string
  to: string
  /** The paycheck's take-home, over the window. */
  income: number
  /** Confirmed debt payments due in the window, soonest first. */
  bills: ScheduledPayment[]
  billsTotal: number
  livingCosts: number
  /** No living costs entered — the need is debt only, and understated. */
  livingCostsMissing: boolean
  need: number
  shortfall: number
  leftover: number
  toSavings: number
  toChecking: number
  toExtraDebt: number
  priorityDebt: Debt | null
  dash: DashRate | null
  dashHours: number | null
  /** Take-home per Depop sale after fees and what the item cost. */
  depopPerSale: number | null
  depopSales: number | null
  /** Half the gap from each: hours, then sales. */
  mix: { hours: number; sales: number } | null
}

/**
 * DoorDash per hour, from shifts that recorded hours. Shifts without hours
 * are left out entirely: counting their earnings over only the other shifts'
 * hours would inflate the rate.
 *
 * Tax is estimated on profit after the mileage deduction where miles were
 * logged — the deduction the IRS actually allows — and after gas where not.
 */
export function dashRate(shifts: Shift[], wages: PaycheckInputs | undefined, entered?: number): DashRate | null {
  const timed = shifts.filter((s) => (s.hours ?? 0) > 0)
  const hoursLogged = timed.reduce((h, s) => h + (s.hours ?? 0), 0)

  let perHour: number
  let taxablePerHour: number
  let source: DashRate['source']
  if (hoursLogged > 0) {
    perHour = timed.reduce((n, s) => n + s.earnings - s.gasCost, 0) / hoursLogged
    taxablePerHour =
      timed.reduce((n, s) => n + s.earnings - (s.miles ? s.miles * MILEAGE_RATE : s.gasCost), 0) / hoursLogged
    source = 'logged'
  } else if (entered && entered > 0) {
    perHour = entered
    taxablePerHour = entered
    source = 'entered'
  } else {
    return null
  }

  // Gig profit is taxed on top of the FedEx wages, so at their marginal rate.
  const wageTaxable = wages
    ? Math.max(
        estimatePaycheck(wages).yearGross -
          Math.max(wages.preTaxPerCheck || 0, 0) * CHECKS_PER_YEAR[wages.frequency] -
          FEDERAL_STANDARD_DEDUCTION,
        0,
      )
    : 0
  const rate = SELF_EMPLOYMENT_RATE + QBI_SHARE * marginalRate(wageTaxable) + NC_RATE
  const taxPerHour = Math.max(taxablePerHour, 0) * rate
  return { perHour, taxPerHour, keepPerHour: perHour - taxPerHour, source, hoursLogged }
}

export function depopPerSale(price?: number, cost?: number): number | null {
  if (!price || price <= 0) return null
  const fees = price * DEPOP_PROCESSING_RATE + DEPOP_PROCESSING_FLAT
  return price - fees - Math.max(cost ?? 0, 0)
}

export function buildPlan(state: AppState, window: PlanWindow, now = today()): Plan {
  const weeks = upcomingWeeks(state, window === 'week' ? 1 : 4, now)
  const from = weeks[0].from
  const to = weeks[weeks.length - 1].to

  const bills = weeks.flatMap((w) => w.items).sort((a, b) => a.date.localeCompare(b.date))
  // Debt payments and dated subscriptions both land on a day in the window.
  const billsTotal = weeks.reduce((n, w) => n + w.debtDue + w.billsDue, 0)
  const livingCosts = weeks.reduce((n, w) => n + w.livingCosts, 0)
  const need = billsTotal + livingCosts

  // Pay is spread evenly by week. The payday is not known, so a biweekly check
  // is counted as half in each of its two weeks rather than guessed at.
  const paycheck = state.paycheck ? estimatePaycheck(state.paycheck) : null
  const income = paycheck ? (paycheck.yearNet / 52) * weeks.length : 0

  const shortfall = Math.max(need - income, 0)
  const leftover = Math.max(income - need, 0)
  const split = splitLeftover(state, leftover)

  const dash = dashRate(state.shifts, state.paycheck, state.plan?.dashPerHour)
  const dashHours = shortfall > 0 && dash && dash.keepPerHour > 0 ? shortfall / dash.keepPerHour : null
  const perSale = depopPerSale(state.plan?.depopPrice, state.plan?.depopCost)
  const depopSales = shortfall > 0 && perSale && perSale > 0 ? Math.ceil(shortfall / perSale) : null
  const mix =
    dash && dashHours !== null && depopSales !== null && perSale
      ? { hours: shortfall / 2 / dash.keepPerHour, sales: Math.ceil(shortfall / 2 / perSale) }
      : null

  return {
    window,
    from,
    to,
    income,
    bills,
    billsTotal,
    livingCosts,
    livingCostsMissing: state.expenses.length === 0,
    need,
    shortfall,
    leftover,
    ...split,
    dash,
    dashHours,
    depopPerSale: perSale,
    depopSales,
    mix,
  }
}
