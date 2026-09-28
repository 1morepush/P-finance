import type { AppState, Debt } from '../types'
import { orderByStrategy, weeklyExpenseObligation } from './finance'
import { weeklyCommitment } from './schedule'

export interface WeeklySplit {
  available: number
  /** Weekly share of what is genuinely scheduled over the next four weeks. */
  weeklyMinimum: number
  /** Weekly share of recurring living costs. Zero until expenses are entered. */
  weeklyExpenses: number
  /** Minimums plus living costs — everything this check has to cover first. */
  weeklyCommitted: number
  shortfall: number
  afterMinimum: number
  toSavings: number
  /** Left in checking on purpose, to build a cushion. Needs no action — it simply stays. */
  toChecking: number
  toExtraDebt: number
  priorityDebt: Debt | null
}

/**
 * Suggests how to split THIS CHECK across debt payments, recurring living costs,
 * savings, and extra toward the top-priority debt.
 *
 * The debt share is the mean of the next four weeks of actual scheduled
 * payments, not a monthly rate divided down. A rate assumes every plan bills
 * forever; three of these are Pay-in-4 plans finishing in October, so a rate
 * disagrees with the calendar the moment you look at a real month.
 *
 * Living costs come out before anything is called leftover — without them the
 * split hands rent money to savings and calls it a surplus.
 *
 * Deliberately ignores the existing bank balance: splitting the whole balance
 * would sweep the account every week and stop the checking cushion from ever
 * building. Only new income is allocated; whatever is already banked stays put.
 */
export function calculateWeeklySplit(state: AppState, incomeAmount: number): WeeklySplit {
  const available = Math.max(incomeAmount, 0)
  const weeklyMinimum = weeklyCommitment(state.debts)
  const weeklyExpenses = weeklyExpenseObligation(state)
  const weeklyCommitted = weeklyMinimum + weeklyExpenses
  const shortfall = Math.max(weeklyCommitted - available, 0)
  const afterMinimum = Math.max(available - weeklyCommitted, 0)

  const { toSavings, toChecking, toExtraDebt, priorityDebt } = splitLeftover(state, afterMinimum)

  return {
    available,
    weeklyMinimum,
    weeklyExpenses,
    weeklyCommitted,
    shortfall,
    afterMinimum,
    toSavings,
    toChecking,
    toExtraDebt,
    priorityDebt,
  }
}

/**
 * Divides money left after the bills by the Settings percentages: savings, a
 * cushion kept in checking, and the rest as extra toward the top debt.
 *
 * Shared by the Dashboard split and the paycheck plan so the two can never
 * divide the same leftover differently.
 */
export function splitLeftover(
  state: AppState,
  leftover: number,
): { toSavings: number; toChecking: number; toExtraDebt: number; priorityDebt: Debt | null } {
  const amount = Math.max(leftover, 0)
  // Clamp so the two reserved shares can never exceed the leftover and drive
  // extra-debt negative, however the sliders are set.
  const savingsPct = Math.max(state.settings.savingsPercent || 0, 0)
  const checkingPct = Math.max(state.settings.keepInCheckingPercent || 0, 0)
  const reservedPct = Math.min(savingsPct + checkingPct, 100)
  const scale = savingsPct + checkingPct > 100 ? reservedPct / (savingsPct + checkingPct) : 1

  const toSavings = amount * ((savingsPct * scale) / 100)
  const toChecking = amount * ((checkingPct * scale) / 100)
  const toExtraDebt = Math.max(amount - toSavings - toChecking, 0)
  const ordered = orderByStrategy(state.debts, state.settings.strategy)
  return { toSavings, toChecking, toExtraDebt, priorityDebt: ordered[0] ?? null }
}
