import type { AppState, Expense, ExpenseCadence, IncomeFrequency } from '../types'
import { addDays, monthlyScheduled, scheduledInDays, today } from './schedule'

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

/**
 * Income received across a forward window, pro-rated for any source that stops
 * partway through it.
 */
function incomeAcross(state: AppState, from: string, days: number): number {
  const to = addDays(from, days - 1)
  return state.incomeSources
    .filter((s) => s.active)
    .reduce((sum, s) => {
      const perMonth = s.amount * INCOME_PER_MONTH[s.frequency]
      if (!s.endsOn) return sum + perMonth
      if (s.endsOn < from) return sum
      if (s.endsOn >= to) return sum + perMonth
      const covered = (new Date(`${s.endsOn}T00:00:00Z`).getTime() -
        new Date(`${from}T00:00:00Z`).getTime()) / 86400000 + 1
      return sum + perMonth * (covered / days)
    }, 0)
}

export interface Runway {
  monthlyIncome: number
  monthlyExpenses: number
  /** Debt actually scheduled over the next 30 days, from real due dates. */
  monthlyMinimums: number
  /** The following calendar month, which is usually lower as short plans finish. */
  nextMonthMinimums: number
  nextMonthLabel: string
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
   * Months the reserves last, walking the real schedule forward. Null when
   * nothing is being drawn down.
   */
  monthsOfCover: number | null
  /** The month reserves are exhausted. */
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
 * Debt is taken from the actual schedule month by month rather than a smoothed
 * rate: these plans finish at different times, so the commitment falls from
 * about $1,048 over the next 30 days to $549 by November, and any single rate
 * would be wrong for every real month.
 */
export function runway(state: AppState, now = today()): Runway {
  const income = monthlyIncomeOn(state, now)
  const expenses = monthlyExpenses(state)
  const minimums = scheduledInDays(state.debts, 30, now)
  const reserves = state.bankBalance.amount + state.savingsBalance

  const ahead = monthlyScheduled(state.debts, 3, addDays(now, 1))
  const nextMonthRow = ahead[1] ?? ahead[0]

  const ending = state.incomeSources
    .filter((s) => s.active && s.endsOn && s.endsOn >= now && s.amount > 0)
    .sort((a, b) => (a.endsOn ?? '').localeCompare(b.endsOn ?? ''))[0]

  const incomeEndsOn = ending?.endsOn ?? null
  const incomeAfterEnd = incomeEndsOn
    ? monthlyIncomeOn(state, addMonthsApprox(incomeEndsOn, 0.1))
    : income

  const monthlyNet = income - expenses - minimums
  const netAfterEnd = incomeAfterEnd - expenses - minimums

  // Walk forward in 30-day windows, spending each window's actual scheduled debt
  // plus living costs against reserves. Income is pro-rated across the window a
  // source ends in — crediting a whole month for four remaining days of benefit
  // is how a drawdown gets hidden.
  let pot = reserves
  let monthsOfCover: number | null = null
  let coveredUntil: string | null = null
  for (let i = 0; i < 60; i++) {
    const start = addDays(now, i * 30)
    const inflow = incomeAcross(state, start, 30)
    const outflow = scheduledInDays(state.debts, 30, start) + expenses
    const delta = inflow - outflow
    if (delta >= 0) {
      pot += delta
      continue
    }
    if (pot + delta < 0) {
      // Runs out partway through this window.
      monthsOfCover = i + pot / -delta
      coveredUntil = addDays(now, Math.round(monthsOfCover * 30))
      break
    }
    pot += delta
  }

  return {
    monthlyIncome: income,
    monthlyExpenses: expenses,
    monthlyMinimums: minimums,
    nextMonthMinimums: nextMonthRow?.total ?? 0,
    nextMonthLabel: nextMonthRow?.month ?? '',
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
  return scheduledInDays(state.debts, 30, now) / income
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
