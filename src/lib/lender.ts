import type { Debt, DebtProduct } from '../types'
import { activeDebts } from './finance'
import { projectPayments, type ScheduledPayment } from './schedule'

/**
 * Who the money is actually owed to. Five Affirm plans are five lines on one
 * account, and a hardship call is made to Affirm, not to "Affirm Hotel Keihan
 * Tokyo" — so this is the grouping that call wants on screen.
 */
export type Lender = 'PayPal' | 'Affirm' | 'Klarna' | 'Apple Card' | 'Event plans' | 'People'

const LENDER_OF: Record<DebtProduct, Lender> = {
  paypal_pay_monthly: 'PayPal',
  paypal_pay_in_4: 'PayPal',
  affirm_pay_monthly: 'Affirm',
  affirm_pay_in_4: 'Affirm',
  klarna_pay_in_4: 'Klarna',
  credit_card: 'Apple Card',
  event_installment: 'Event plans',
  personal: 'People',
}

export function lenderOf(debt: Debt): Lender {
  return LENDER_OF[debt.product]
}

export interface LenderSummary {
  lender: Lender
  debts: Debt[]
  total: number
  /** Everything scheduled across the lender's plans over the next 30 days. */
  next30: number
  /** The soonest payment due to this lender, if any is scheduled. */
  next: ScheduledPayment | null
  /** Highest APR among the plans — what a deferral would be worth fighting for. */
  apr: number
}

/** Active debt grouped by lender, biggest total first. */
export function byLender(debts: Debt[], todayISO: string, horizonDays = 30): LenderSummary[] {
  const groups = new Map<Lender, Debt[]>()
  for (const d of activeDebts(debts)) {
    const l = lenderOf(d)
    if (!groups.has(l)) groups.set(l, [])
    groups.get(l)!.push(d)
  }

  const end = new Date(`${todayISO}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + horizonDays - 1)
  const horizon = end.toISOString().slice(0, 10)

  return [...groups.entries()]
    .map(([lender, list]) => {
      const payments = list
        .flatMap(projectPayments)
        .filter((p) => p.date >= todayISO)
        .sort((a, b) => a.date.localeCompare(b.date))
      return {
        lender,
        debts: list,
        total: list.reduce((s, d) => s + d.balance, 0),
        next30: payments.filter((p) => p.date <= horizon).reduce((s, p) => s + p.amount, 0),
        next: payments[0] ?? null,
        apr: Math.max(...list.map((d) => d.apr), 0),
      }
    })
    .sort((a, b) => b.total - a.total)
}
