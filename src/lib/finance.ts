import type { AppState, ClearedDebt, Debt, DebtStrategy, PriorityTier } from '../types'
import { categoryOf } from '../types'

const WEEKS_PER_MONTH = 4.345

/** Confirmed, outstanding debt. Excludes `potential` (unconfirmed) and paid-off entries. */
export function activeDebts(debts: Debt[]): Debt[] {
  return debts.filter((d) => d.status === 'active' && d.balance > 0)
}

/** Unconfirmed debts — tracked and shown, but kept out of the active totals. */
export function potentialDebts(debts: Debt[]): Debt[] {
  return debts.filter((d) => d.status === 'potential' && d.balance > 0)
}

/** Active debts carrying a real recurring payment obligation (excludes informal personal debts). */
export function scheduledDebts(debts: Debt[]): Debt[] {
  return activeDebts(debts).filter((d) => categoryOf(d) !== 'personal' && d.monthlyPayment)
}

export function totalMonthlyMinimum(debts: Debt[]): number {
  return scheduledDebts(debts).reduce((sum, d) => sum + (d.monthlyPayment ?? 0), 0)
}

export function weeklyMinimumObligation(debts: Debt[]): number {
  return totalMonthlyMinimum(debts) / WEEKS_PER_MONTH
}

/**
 * Orders active debts by payoff strategy.
 * - `tier`: the priority tiers from the source data (urgent → high interest → 0% BNPL → Apple Card → personal),
 *   breaking ties by APR then balance.
 * - `avalanche`: highest APR first.
 * - `snowball`: smallest balance first.
 */
export function orderByStrategy(debts: Debt[], strategy: DebtStrategy): Debt[] {
  const list = activeDebts(debts)
  if (strategy === 'tier') {
    return [...list].sort(
      (a, b) => a.priorityTier - b.priorityTier || b.apr - a.apr || a.balance - b.balance,
    )
  }
  if (strategy === 'avalanche') {
    return [...list].sort((a, b) => b.apr - a.apr || a.balance - b.balance)
  }
  return [...list].sort((a, b) => a.balance - b.balance)
}

export function totalDebt(debts: Debt[]): number {
  return activeDebts(debts).reduce((sum, d) => sum + d.balance, 0)
}

export function totalPotentialDebt(debts: Debt[]): number {
  return potentialDebts(debts).reduce((sum, d) => sum + d.balance, 0)
}

export function totalByTier(debts: Debt[], tier: PriorityTier): number {
  return activeDebts(debts)
    .filter((d) => d.priorityTier === tier)
    .reduce((sum, d) => sum + d.balance, 0)
}

export function totalCleared(cleared: ClearedDebt[]): number {
  return cleared.reduce((sum, c) => sum + c.amountCleared, 0)
}

export interface WeeklySplit {
  available: number
  weeklyMinimum: number
  shortfall: number
  afterMinimum: number
  toSavings: number
  toExtraDebt: number
  priorityDebt: Debt | null
}

/**
 * Suggests how to split THIS CHECK across this month's minimum debt
 * obligations (spread evenly over ~4.3 weeks), savings, and extra toward the
 * top-priority debt.
 *
 * Deliberately ignores the existing bank balance: splitting the whole balance
 * would sweep the account every week and stop the checking cushion from ever
 * building. Only new income is allocated; whatever is already banked stays put.
 */
export function calculateWeeklySplit(state: AppState, incomeAmount: number): WeeklySplit {
  const available = Math.max(incomeAmount, 0)
  const weeklyMinimum = weeklyMinimumObligation(state.debts)
  const shortfall = Math.max(weeklyMinimum - available, 0)
  const afterMinimum = Math.max(available - weeklyMinimum, 0)
  const toSavings = afterMinimum * (state.settings.savingsPercent / 100)
  const toExtraDebt = afterMinimum - toSavings
  const ordered = orderByStrategy(state.debts, state.settings.strategy)

  return {
    available,
    weeklyMinimum,
    shortfall,
    afterMinimum,
    toSavings,
    toExtraDebt,
    priorityDebt: ordered[0] ?? null,
  }
}

/** Amortizes a revolving balance at a fixed monthly payment; returns months to payoff, or null if payment never clears interest. */
export function estimatePayoffMonths(
  balance: number,
  aprPercent: number,
  monthlyPayment: number,
): number | null {
  const monthlyRate = aprPercent / 100 / 12
  if (monthlyRate <= 0) return Math.ceil(balance / monthlyPayment)
  const interestOnly = balance * monthlyRate
  if (monthlyPayment <= interestOnly) return null
  const months =
    -Math.log(1 - (balance * monthlyRate) / monthlyPayment) / Math.log(1 + monthlyRate)
  return Math.ceil(months)
}

export function latestScheduledPayoffDate(debts: Debt[]): string | null {
  const dates = scheduledDebts(debts)
    .map((d) => d.finalPaymentDate)
    .filter((d): d is string => Boolean(d))
  if (dates.length === 0) return null
  return dates.sort().at(-1) ?? null
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  })
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Renders a due value that may be an ISO date or a token such as `ASAP` / `flexible`. */
export function formatDue(value: string): string {
  return ISO_DATE.test(value) ? formatDate(value) : value
}
