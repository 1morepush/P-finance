import type { Debt } from '../types'
import { activeDebts } from './finance'
import { PAYMENT_CADENCE, projectPayments } from './schedule'

/** Compounding periods per year for each billing cadence. */
const PERIODS_PER_YEAR = { monthly: 12, biweekly: 26 } as const

export interface EarlyPayoff {
  /** What clearing this debt today would cost. */
  today: number
  /** Everything still owed if the schedule simply runs its course. */
  scheduled: number
  /** Interest avoided by settling now. Zero on 0% plans — there is none to avoid. */
  saved: number
}

/**
 * Runs a revolving balance forward at a fixed payment, returning what it ends up
 * costing in total. Unlike a fixed plan the interest is not pre-computed, so it
 * has to be accrued month by month.
 */
function amortizeRevolving(balance: number, aprPercent: number, payment: number) {
  const rate = aprPercent / 100 / 12
  let owed = balance
  let paid = 0
  for (let i = 0; i < 1200 && owed > 0; i++) {
    owed += owed * rate
    const due = Math.min(payment, owed)
    if (due <= 0) break
    owed -= due
    paid += due
    // A payment that cannot cover the interest never clears the balance.
    if (due <= owed * rate) return { totalPaid: Infinity, months: Infinity }
  }
  return { totalPaid: paid, months: Math.ceil(paid / payment) }
}

/**
 * What settling a debt in full today would cost, and what that saves.
 *
 * Fixed instalment plans (Affirm, Klarna, PayPal) quote a balance with their
 * financing charge already baked in, so the remaining payments are discounted
 * back at the plan's APR to get the payoff figure. That models a lender who
 * waives unearned interest on early settlement, which is the usual arrangement —
 * a lender who does not simply charges the full remaining balance, and the
 * saving is nil.
 *
 * Revolving credit is the reverse: nothing is pre-computed, so paying today
 * costs exactly the balance and avoids every future interest charge.
 */
export function earlyPayoff(debt: Debt): EarlyPayoff {
  const none = { today: debt.balance, scheduled: debt.balance, saved: 0 }
  if (debt.balance <= 0) return { today: 0, scheduled: 0, saved: 0 }

  if (debt.product === 'credit_card') {
    if (!debt.monthlyPayment || debt.apr <= 0) return none
    const { totalPaid } = amortizeRevolving(debt.balance, debt.apr, debt.monthlyPayment)
    if (!Number.isFinite(totalPaid)) return none
    return { today: debt.balance, scheduled: totalPaid, saved: totalPaid - debt.balance }
  }

  const cadence = PAYMENT_CADENCE[debt.product]
  if (!cadence || debt.apr <= 0) return none

  const payments = projectPayments(debt)
  if (payments.length === 0) return none

  const rate = debt.apr / 100 / PERIODS_PER_YEAR[cadence]
  const scheduled = payments.reduce((s, p) => s + p.amount, 0)
  // Each instalment discounted by the number of periods until it falls due.
  const today = payments.reduce((s, p, i) => s + p.amount / (1 + rate) ** (i + 1), 0)
  return { today, scheduled, saved: Math.max(scheduled - today, 0) }
}

export interface PayoffSummary {
  today: number
  scheduled: number
  saved: number
  /** Debts where settling early actually avoids interest, biggest saving first. */
  worthwhile: { debt: Debt; payoff: EarlyPayoff }[]
}

export function payoffSummary(debts: Debt[]): PayoffSummary {
  const rows = activeDebts(debts).map((debt) => ({ debt, payoff: earlyPayoff(debt) }))
  return {
    today: rows.reduce((s, r) => s + r.payoff.today, 0),
    scheduled: rows.reduce((s, r) => s + r.payoff.scheduled, 0),
    saved: rows.reduce((s, r) => s + r.payoff.saved, 0),
    worthwhile: rows
      .filter((r) => r.payoff.saved >= 0.01)
      .sort((a, b) => b.payoff.saved - a.payoff.saved),
  }
}
