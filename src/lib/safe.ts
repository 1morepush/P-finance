import type { AppState, Debt } from '../types'
import { dueItems } from './calendar'
import { expenseMonthly } from './budget'
import { activeDebts } from './finance'
import { nextPayday } from './payday'
import { FLOOR_TARGET } from '../data/recoveryPlan'
import { addDays, daysUntil, today, type ScheduledPayment } from './schedule'

export interface SafeToSpend {
  bank: number
  floor: number
  /** The next payday after today, if one is known. */
  payday: string | null
  /** The last day the bank has to cover alone: the day before payday, or six days on. */
  until: string
  /** Everything confirmed that comes out by then, anything past due included. */
  due: number
  dueList: ScheduledPayment[]
  /** Food, gas and the other costs with no set day, for the days until then. */
  living: number
  /** None of those costs has been entered, so `living` is zero and `free` is too generous. */
  livingMissing: boolean
  /** What is left once the floor, the bills and living costs are held back. */
  free: number
}

/**
 * How much can be spent, or put on a debt, without touching the floor or
 * anything due before the next paycheck. One number, so "can I afford this"
 * and "how much extra can go on the card" are the same question.
 */
export function safeToSpend(state: AppState, now = today()): SafeToSpend {
  const bank = state.bankBalance.amount
  const floor = state.settings.checkingFloor ?? FLOOR_TARGET
  const payday = nextPayday(state, addDays(now, 1))
  // Never further than a fortnight: a payday that far off is not this week's question.
  const until = payday && daysUntil(payday, now) <= 14 ? addDays(payday, -1) : addDays(now, 6)
  const dueList = dueItems(state, false, now).filter((p) => !p.isPotential && p.date <= until)
  const due = dueList.reduce((n, p) => n + p.amount, 0)
  const undated = state.expenses.filter((e) => !e.nextDue)
  const days = daysUntil(until, now) + 1
  const living = (undated.reduce((n, e) => n + expenseMonthly(e), 0) / 30.44) * days
  const r = (n: number) => Math.round(n * 100) / 100
  return {
    bank,
    floor,
    payday: payday && daysUntil(payday, now) <= 14 ? payday : null,
    until,
    due: r(due),
    dueList,
    living: r(living),
    livingMissing: !state.expenses.some((e) => BUDGET_IDS.includes(e.id as BudgetId)),
    free: r(bank - floor - due - living),
  }
}

// ── the four everyday costs ──────────────────────────────────────────────

export const BUDGET = [
  { id: 'exp-food', name: 'Food and groceries', cadence: 'weekly', per: 'a week', placeholder: '60' },
  { id: 'exp-gas', name: 'Gas (not gig driving)', cadence: 'weekly', per: 'a week', placeholder: '25' },
  { id: 'exp-phone', name: 'Phone', cadence: 'monthly', per: 'a month', placeholder: '50' },
  { id: 'exp-insurance', name: 'Car insurance', cadence: 'monthly', per: 'a month', placeholder: '120' },
] as const
export type BudgetId = (typeof BUDGET)[number]['id']
const BUDGET_IDS: readonly string[] = BUDGET.map((b) => b.id)

/** The amount entered for one of the four, or undefined when it has not been. */
export function budgetAmount(state: AppState, id: BudgetId): number | undefined {
  return state.expenses.find((e) => e.id === id)?.amount
}

/** Saves the four everyday costs as living costs; a blank or zero removes that one. */
export function saveBudget(state: AppState, amounts: Partial<Record<BudgetId, number>>): AppState {
  let expenses = state.expenses
  for (const b of BUDGET) {
    if (!(b.id in amounts)) continue
    const amount = amounts[b.id] ?? 0
    expenses = expenses.filter((e) => e.id !== b.id)
    if (amount > 0)
      expenses = [...expenses, { id: b.id, name: b.name, amount, cadence: b.cadence, essential: true }]
  }
  return { ...state, expenses }
}

// ── the payoff plan ──────────────────────────────────────────────────────

/** What the plan says to put on the card each month, minimum included. */
export const PAYOFF_MONTHLY = 300

/** The debt that is costing money: the highest rate still being charged. */
export function payoffTarget(debts: Debt[]): Debt | null {
  return [...activeDebts(debts)].filter((d) => d.apr > 0 && d.balance > 0).sort((a, b) => b.apr - a.apr)[0] ?? null
}

export interface Projection {
  months: number
  interest: number
  /** The month it reaches zero, YYYY-MM. Null if the payment never outruns the interest. */
  doneBy: string | null
}

/**
 * Walks the balance down month by month: interest on, payment off, and a lump
 * sum in the month it is expected. Month 1 is the month after `from`.
 */
export function project(balance: number, apr: number, monthly: number, from: string, lump?: { amount: number; month: string }): Projection {
  const rate = apr / 100 / 12
  let bal = balance
  let interest = 0
  let [y, m] = from.slice(0, 7).split('-').map(Number)
  for (let i = 1; i <= 600; i++) {
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
    const month = `${y}-${String(m).padStart(2, '0')}`
    const charged = bal * rate
    interest += charged
    bal += charged
    if (lump && month === lump.month) bal -= lump.amount
    bal -= Math.min(monthly, Math.max(bal, 0))
    if (bal <= 0.005) return { months: i, interest: Math.round(interest), doneBy: month }
    if (i > 12 && bal >= balance && !lump) break
  }
  return { months: Infinity, interest: Math.round(interest), doneBy: null }
}

export interface PayoffPlan {
  debt: Debt
  monthly: number
  /** Paid toward it so far this calendar month. */
  paidThisMonth: number
  /** Still to go this month to reach `monthly`. */
  toGo: number
  /** What can go on it right now without touching the floor or the bills. */
  payNow: number
  interestPerMonth: number
  atMinimum: Projection
  atTarget: Projection
  /** With the lump sum, when one is expected. */
  withLump: Projection | null
  lump: { amount: number; month: string; name: string } | null
}

export function payoffPlan(state: AppState, now = today(), lump: PayoffPlan['lump'] = null): PayoffPlan | null {
  const debt = payoffTarget(state.debts)
  if (!debt) return null
  const monthly = state.settings.payoffMonthly ?? PAYOFF_MONTHLY
  const month = now.slice(0, 7)
  const paidThisMonth = state.payments
    .filter((p) => p.debtId === debt.id && p.date.startsWith(month))
    .reduce((n, p) => n + p.amount, 0)
  const toGo = Math.max(Math.round((monthly - paidThisMonth) * 100) / 100, 0)
  const free = safeToSpend(state, now).free
  const minimum = debt.monthlyPayment ?? monthly
  const useLump = lump && lump.month > month ? lump : null
  return {
    debt,
    monthly,
    paidThisMonth: Math.round(paidThisMonth * 100) / 100,
    toGo,
    payNow: Math.max(Math.min(toGo, Math.floor(free), debt.balance), 0),
    interestPerMonth: Math.round(((debt.balance * debt.apr) / 100 / 12) * 100) / 100,
    atMinimum: project(debt.balance, debt.apr, minimum, now),
    atTarget: project(debt.balance, debt.apr, monthly, now),
    withLump: useLump ? project(debt.balance, debt.apr, monthly, now, useLump) : null,
    lump: useLump,
  }
}
