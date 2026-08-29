import type { Debt, DebtProduct } from '../types'
import { activeDebts, estimatePayoffMonths, potentialDebts } from './finance'

export type Cadence = 'monthly' | 'biweekly' | null

/**
 * How often each product bills. Pay-in-4 plans run every two weeks, not monthly —
 * modelling them as monthly would put their payments in the wrong months entirely.
 */
export const PAYMENT_CADENCE: Record<DebtProduct, Cadence> = {
  paypal_pay_monthly: 'monthly',
  affirm_pay_monthly: 'monthly',
  credit_card: 'monthly',
  paypal_pay_in_4: 'biweekly',
  affirm_pay_in_4: 'biweekly',
  klarna_pay_in_4: 'biweekly',
  personal: null,
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isDate(value: string | undefined): value is string {
  return Boolean(value && ISO_DATE.test(value))
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Adds months, clamping to the last day of a shorter target month (Jan 31 -> Feb 28). */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1 + n, 1))
  const daysInMonth = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate()
  t.setUTCDate(Math.min(d, daysInMonth))
  return t.toISOString().slice(0, 10)
}

function step(iso: string, cadence: Cadence, n: number): string {
  return cadence === 'biweekly' ? addDays(iso, 14 * n) : addMonths(iso, n)
}

export interface ScheduledPayment {
  debtId: string
  debtName: string
  product: DebtProduct
  date: string
  amount: number
  isFinal: boolean
  /** From an unconfirmed debt — shown, but kept out of the confirmed totals. */
  isPotential: boolean
}

/**
 * Projects the remaining payments for one debt.
 *
 * Fixed installment plans (Affirm/Klarna/PayPal) quote a balance that already
 * includes their financing charge, so the count is simply balance / payment.
 * Revolving credit accrues interest on the outstanding balance instead, so its
 * count comes from amortisation — dividing would badly understate it.
 */
export function projectPayments(debt: Debt): ScheduledPayment[] {
  if (debt.balance <= 0 || !isDate(debt.nextDue)) return []
  const cadence = PAYMENT_CADENCE[debt.product]
  const payment = debt.monthlyPayment ?? 0
  const base = {
    debtId: debt.id,
    debtName: debt.name,
    product: debt.product,
    isPotential: debt.status === 'potential',
  }

  // No recurring plan (an informal debt with a date on it): a single settlement
  // of the whole balance on that date.
  if (!cadence || payment <= 0) {
    return [{ ...base, date: debt.nextDue, amount: debt.balance, isFinal: true }]
  }

  const count =
    debt.product === 'credit_card' && debt.apr > 0
      ? (estimatePayoffMonths(debt.balance, debt.apr, payment) ?? 0)
      : Math.ceil(debt.balance / payment)
  if (count <= 0) return []

  const out: ScheduledPayment[] = []
  for (let i = 0; i < count; i++) {
    const isFinal = i === count - 1
    // Only fixed plans have a clean remainder; a revolving final payment is an
    // approximation either way, so keep it at the regular amount.
    const remainder = debt.balance - payment * (count - 1)
    const amount =
      isFinal && debt.product !== 'credit_card' && remainder > 0 && remainder < payment
        ? remainder
        : payment
    out.push({ ...base, date: step(debt.nextDue, cadence, i), amount, isFinal })
  }
  return out
}

/** Every remaining payment, earliest first. Unconfirmed debts are opt-in. */
export function allPayments(debts: Debt[], includePotential = false): ScheduledPayment[] {
  const pool = includePotential ? [...activeDebts(debts), ...potentialDebts(debts)] : activeDebts(debts)
  return pool
    .flatMap(projectPayments)
    .sort((a, b) => a.date.localeCompare(b.date) || a.debtName.localeCompare(b.debtName))
}

/** Sums only confirmed payments, leaving unconfirmed ones out of the figure. */
export function sumConfirmed(payments: ScheduledPayment[]): number {
  return sumPayments(payments.filter((p) => !p.isPotential))
}

export function sumPotential(payments: ScheduledPayment[]): number {
  return sumPayments(payments.filter((p) => p.isPotential))
}

/** The YYYY-MM after the given one. */
export function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7)
}

/**
 * What lands in the opening stretch of the following month — the figure to have
 * ready before a month closes, so a month-end balance isn't mistaken for slack.
 */
export function openingOfNextMonth(
  payments: ScheduledPayment[],
  month: string,
  days = 14,
): ScheduledPayment[] {
  const start = `${nextMonth(month)}-01`
  return paymentsBetween(payments, start, addDays(start, days - 1))
}

export function paymentsBetween(
  payments: ScheduledPayment[],
  fromISO: string,
  toISO: string,
): ScheduledPayment[] {
  return payments.filter((p) => p.date >= fromISO && p.date <= toISO)
}

export function sumPayments(payments: ScheduledPayment[]): number {
  return payments.reduce((s, p) => s + p.amount, 0)
}

/** Total falling due within the next `days` days — the figure to keep in reserve. */
export function dueWithin(debts: Debt[], days: number, todayISO = today()): number {
  return sumPayments(paymentsBetween(allPayments(debts), todayISO, addDays(todayISO, days)))
}

/** The computed final payment date for one debt, or null if it has no schedule. */
export function projectedPayoffDate(debt: Debt): string | null {
  const p = projectPayments(debt)
  return p.length ? p[p.length - 1].date : null
}

/** When the last fixed-schedule (non-revolving) plan finishes. */
export function installmentFreeDate(debts: Debt[]): string | null {
  const dates = activeDebts(debts)
    .filter((d) => d.product !== 'credit_card')
    .map(projectedPayoffDate)
    .filter((d): d is string => Boolean(d))
  return dates.length ? dates.sort().at(-1)! : null
}

/** When every scheduled debt, revolving included, finishes. */
export function debtFreeDate(debts: Debt[]): string | null {
  const dates = activeDebts(debts)
    .map(projectedPayoffDate)
    .filter((d): d is string => Boolean(d))
  return dates.length ? dates.sort().at(-1)! : null
}

export interface ScheduleMismatch {
  debt: Debt
  stated: string
  computed: string
}

/**
 * Debts whose recorded final payment date disagrees with the schedule implied by
 * their balance, payment and cadence — usually a stale date rather than a real one.
 */
export function scheduleMismatches(debts: Debt[]): ScheduleMismatch[] {
  return activeDebts(debts).flatMap((debt) => {
    const computed = projectedPayoffDate(debt)
    if (!computed || !isDate(debt.finalPaymentDate) || debt.finalPaymentDate === computed) return []
    return [{ debt, stated: debt.finalPaymentDate, computed }]
  })
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Groups payments by calendar month, preserving date order. */
export function groupByMonth(payments: ScheduledPayment[]): { month: string; items: ScheduledPayment[] }[] {
  const out: { month: string; items: ScheduledPayment[] }[] = []
  for (const p of payments) {
    const month = p.date.slice(0, 7)
    const last = out[out.length - 1]
    if (last && last.month === month) last.items.push(p)
    else out.push({ month, items: [p] })
  }
  return out
}

export function formatMonth(month: string): string {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

export function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function daysUntil(iso: string, todayISO = today()): number {
  return Math.round(
    (new Date(`${iso}T00:00:00Z`).getTime() - new Date(`${todayISO}T00:00:00Z`).getTime()) / 86400000,
  )
}
