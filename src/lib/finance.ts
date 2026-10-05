import type {
  AppState,
  ClearedDebt,
  Debt,
  DebtStrategy,
  ExpenseCadence,
  PriorityTier,
} from '../types'
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

/** Occurrences per month for each expense cadence. */
const EXPENSE_PER_MONTH: Record<ExpenseCadence, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  yearly: 1 / 12,
}

// Defined here rather than imported from ./budget, which already depends on this
// module — the split needs the figure, and a cycle would be the price of sharing it.
export function weeklyExpenseObligation(state: AppState): number {
  const monthly = state.expenses.reduce((sum, e) => sum + e.amount * EXPENSE_PER_MONTH[e.cadence], 0)
  return monthly / WEEKS_PER_MONTH
}

/**
 * A rate to the whole percent: 35.99% and 36% cost the same, and splitting
 * them by the hundredth put every Affirm plan ahead of both PayPal ones.
 */
const rateBand = (d: Debt) => Math.round(d.apr)

/**
 * Monthly payment freed per dollar it takes to finish the debt, to the cent.
 * Among debts at the same rate, paying off the one that frees the most cash
 * soonest is what eases the month — Tokyo frees $53.45 for $267, where
 * Columbia frees $26.17 for $209. Extra on an instalment plan only shortens
 * it; nothing is freed until it is gone.
 */
const cashFreed = (d: Debt) =>
  d.monthlyPayment && d.balance > 0 ? Math.round((d.monthlyPayment / d.balance) * 100) / 100 : 0

/**
 * Orders active debts by payoff strategy.
 * - `tier`: the priority tiers from the source data (urgent → high interest → 0% BNPL → Apple Card → personal),
 *   then by rate to the whole percent, then by monthly cash freed per dollar of balance,
 *   then smallest balance first.
 * - `avalanche`: highest APR first.
 * - `snowball`: smallest balance first.
 */
export function orderByStrategy(debts: Debt[], strategy: DebtStrategy): Debt[] {
  const list = activeDebts(debts)
  if (strategy === 'tier') {
    return [...list].sort(
      (a, b) =>
        a.priorityTier - b.priorityTier ||
        rateBand(b) - rateBand(a) ||
        cashFreed(b) - cashFreed(a) ||
        a.balance - b.balance,
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
