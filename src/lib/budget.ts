import type { AppState, Expense, ExpenseCadence, IncomeFrequency } from '../types'
import { totalMonthlyMinimum } from './finance'
import { today } from './schedule'

export const WEEKS_PER_MONTH = 4.345

/** Occurrences per month, for the frequencies that imply one. */
const INCOME_PER_MONTH: Record<IncomeFrequency, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  variable: 0,
  'one-time': 0,
}

const EXPENSE_PER_MONTH: Record<ExpenseCadence, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
}

export const CADENCE_LABEL: Record<ExpenseCadence, string> = {
  weekly: 'per week',
  biweekly: 'every 2 weeks',
  monthly: 'per month',
}

export function expenseMonthly(expense: Expense): number {
  return expense.amount * EXPENSE_PER_MONTH[expense.cadence]
}

export function monthlyExpenses(state: AppState, essentialOnly = false): number {
  return state.expenses
    .filter((e) => !essentialOnly || e.essential)
    .reduce((sum, e) => sum + expenseMonthly(e), 0)
}

/**
 * Income that can be counted on in a given month. A source past its end date
 * contributes nothing; variable sources contribute nothing until actually logged.
 */
export function monthlyIncomeOn(state: AppState, onDate: string): number {
  return state.incomeSources
    .filter((s) => s.active && (!s.endsOn || s.endsOn >= onDate))
    .reduce((sum, s) => sum + s.amount * INCOME_PER_MONTH[s.frequency], 0)
}

export interface Runway {
  monthlyIncome: number
  monthlyExpenses: number
  monthlyMinimums: number
  /** What is left each month once minimums and recurring costs are met. */
  monthlyNet: number
  /** Everything on hand — banked plus set aside. */
  reserves: number

  /** The first date an active income source stops, if any does. */
  incomeEndsOn: string | null
  /** Which source that is. */
  endingSourceName: string | null
  /** Monthly income the day after that date. */
  incomeAfterEnd: number
  /** Monthly surplus (or deficit) once that income stops. */
  netAfterEnd: number
  /**
   * Months the reserves cover the gap once income stops. Null when there is no
   * gap — nothing is being drawn down, so nothing runs out.
   */
  monthsOfCover: number | null
  /** The month reserves are exhausted at that burn rate. */
  coveredUntil: string | null
}

function addMonthsApprox(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  const whole = Math.floor(months)
  d.setUTCMonth(d.getUTCMonth() + whole)
  d.setUTCDate(d.getUTCDate() + Math.round((months - whole) * 30.44))
  return d.toISOString().slice(0, 10)
}

/**
 * What the figures say about staying afloat, rather than about paying debt off.
 *
 * The app otherwise projects every income source forward forever, so a benefit
 * that runs out simply never shows up — which is exactly the thing worth seeing
 * early enough to act on.
 */
export function runway(state: AppState, now = today()): Runway {
  const income = monthlyIncomeOn(state, now)
  const expenses = monthlyExpenses(state)
  const minimums = totalMonthlyMinimum(state.debts)
  const reserves = state.bankBalance.amount + state.savingsBalance

  const ending = state.incomeSources
    .filter((s) => s.active && s.endsOn && s.endsOn >= now && s.amount > 0)
    .sort((a, b) => (a.endsOn ?? '').localeCompare(b.endsOn ?? ''))[0]

  const incomeEndsOn = ending?.endsOn ?? null
  const incomeAfterEnd = incomeEndsOn
    ? monthlyIncomeOn(state, addMonthsApprox(incomeEndsOn, 0.1))
    : income

  const monthlyNet = income - expenses - minimums
  const netAfterEnd = incomeAfterEnd - expenses - minimums

  // Only a negative net burns through reserves.
  const burn = netAfterEnd < 0 ? -netAfterEnd : 0
  const monthsOfCover = burn > 0 ? reserves / burn : null
  const coveredUntil =
    monthsOfCover === null ? null : addMonthsApprox(incomeEndsOn ?? now, monthsOfCover)

  return {
    monthlyIncome: income,
    monthlyExpenses: expenses,
    monthlyMinimums: minimums,
    monthlyNet,
    reserves,
    incomeEndsOn,
    endingSourceName: ending?.name ?? null,
    incomeAfterEnd,
    netAfterEnd,
    monthsOfCover,
    coveredUntil,
  }
}

/** The share of income already committed to debt minimums. */
export function minimumsShareOfIncome(state: AppState, now = today()): number | null {
  const income = monthlyIncomeOn(state, now)
  if (income <= 0) return null
  return totalMonthlyMinimum(state.debts) / income
}

export type ExpenseInput = Omit<Expense, 'id'>

export function addExpense(state: AppState, input: ExpenseInput): AppState {
  return { ...state, expenses: [...state.expenses, { ...input, id: crypto.randomUUID() }] }
}

export function updateExpense(state: AppState, id: string, input: ExpenseInput): AppState {
  return {
    ...state,
    expenses: state.expenses.map((e) => (e.id === id ? { ...input, id } : e)),
  }
}

export function removeExpense(state: AppState, id: string): AppState {
  return { ...state, expenses: state.expenses.filter((e) => e.id !== id) }
}
