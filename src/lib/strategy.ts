import type { AppState, Debt, DebtStrategy } from '../types'
import { activeDebts, orderByStrategy } from './finance'

export const STRATEGIES: DebtStrategy[] = ['tier', 'avalanche', 'snowball']

export const STRATEGY_LABEL: Record<DebtStrategy, string> = {
  tier: 'Tier',
  avalanche: 'Avalanche',
  snowball: 'Snowball',
}

export interface StrategyResult {
  strategy: DebtStrategy
  /** Every dollar paid before the last debt clears. */
  totalPaid: number
  /** Of that, what was interest rather than principal. */
  interest: number
  months: number
  /**
   * False when the run ended with debt still standing — informal 0% debts with
   * no scheduled payment, which nothing reaches unless there is extra to send.
   * `months` then means "until everything payable cleared", not "debt free".
   */
  clearsEverything: boolean
  /** What is still owed at the end, when it does not clear everything. */
  leftStanding: number
  /** The debt the extra payment goes to first. */
  firstTarget: string | null
}

interface Sim {
  id: string
  balance: number
  /** Only revolving credit accrues; fixed plans quote a balance with the charge baked in. */
  monthlyRate: number
  payment: number
  principal: number
}

/**
 * Runs one payoff ordering forward a month at a time.
 *
 * Fixed instalment plans (Affirm, Klarna, PayPal, event plans) quote a balance
 * that already contains their financing charge, so paying one early finishes it
 * sooner but costs no less. Revolving credit is the opposite: it accrues on
 * whatever is outstanding, so every dollar sent early is interest not charged.
 * That asymmetry is the whole reason the ordering matters.
 */
function simulate(debts: Debt[], strategy: DebtStrategy, extraPerMonth: number): StrategyResult {
  const order = orderByStrategy(debts, strategy).map((d) => d.id)
  const sims: Sim[] = activeDebts(debts).map((d) => ({
    id: d.id,
    balance: d.balance,
    monthlyRate: d.product === 'credit_card' && d.apr > 0 ? d.apr / 100 / 12 : 0,
    // A debt with no scheduled payment (an informal personal one) is only ever
    // touched by the extra, so it does not stall the simulation.
    payment: d.monthlyPayment ?? 0,
    principal: d.balance,
  }))

  const firstTarget = orderByStrategy(debts, strategy)[0]?.name ?? null

  let totalPaid = 0
  let accrued = 0
  let months = 0

  for (; months < 600; months++) {
    const live = sims.filter((s) => s.balance > 0.005)
    if (live.length === 0) break

    // Nothing can move: what is left has no scheduled payment and there is no
    // extra to send it. An informal 0% debt sitting untouched is not a runaway
    // balance — it simply stops here, and costs nothing more.
    if (extraPerMonth <= 0 && live.every((s) => s.payment <= 0)) break

    // Interest first: a month's charge lands before that month's payment.
    for (const s of live) {
      const charge = s.balance * s.monthlyRate
      s.balance += charge
      accrued += charge
    }

    let budget = extraPerMonth
    for (const s of live) {
      const due = Math.min(s.payment, s.balance)
      if (due <= 0) continue
      s.balance -= due
      totalPaid += due
    }

    // The extra cascades down the ordering as each target clears.
    for (const id of order) {
      if (budget <= 0.005) break
      const s = sims.find((x) => x.id === id)
      if (!s || s.balance <= 0.005) continue
      const pay = Math.min(budget, s.balance)
      s.balance -= pay
      totalPaid += pay
      budget -= pay
    }
  }

  // A revolving balance still standing after 600 months is one whose payment
  // never covered its own interest — it does not clear at this rate at all.
  if (sims.some((s) => s.balance > 0.005 && s.monthlyRate > 0)) {
    return {
      strategy,
      totalPaid: Infinity,
      interest: Infinity,
      months: Infinity,
      clearsEverything: false,
      leftStanding: Infinity,
      firstTarget,
    }
  }

  const leftStanding = sims.reduce((sum, s) => sum + Math.max(s.balance, 0), 0)
  return {
    strategy,
    totalPaid,
    interest: accrued,
    months,
    clearsEverything: leftStanding <= 0.005,
    leftStanding,
    firstTarget,
  }
}

export interface StrategyComparison {
  extraPerMonth: number
  results: StrategyResult[]
  best: StrategyResult
  current: StrategyResult
  /** What staying on the current strategy costs against the cheapest one. */
  costOfCurrent: number
  monthsLost: number
}

export function compareStrategies(state: AppState, extraPerMonth: number): StrategyComparison {
  const results = STRATEGIES.map((s) => simulate(state.debts, s, Math.max(extraPerMonth, 0)))
  const best = [...results].sort((a, b) => a.totalPaid - b.totalPaid || a.months - b.months)[0]
  const current = results.find((r) => r.strategy === state.settings.strategy) ?? results[0]
  return {
    extraPerMonth,
    results,
    best,
    current,
    costOfCurrent: Math.max(current.totalPaid - best.totalPaid, 0),
    monthsLost: Math.max(current.months - best.months, 0),
  }
}
