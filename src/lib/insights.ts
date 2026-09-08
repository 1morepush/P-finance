import type { AppState, Debt, IncomeSource } from '../types'
import {
  activeDebts,
  estimatePayoffMonths,
  formatCurrency,
  formatDate,
  totalMonthlyMinimum,
} from './finance'
import { earlyPayoff } from './payoff'
import { addDays, dueWithin, projectedPayoffDate, today } from './schedule'

export type InsightKind = 'opportunity' | 'warning' | 'milestone' | 'context'

export interface Insight {
  id: string
  kind: InsightKind
  title: string
  detail: string
  /** Higher sorts first. */
  weight: number
}

/** Occurrences per month, for the frequencies that imply one. */
const PER_MONTH: Record<IncomeSource['frequency'], number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  variable: 0,
  'one-time': 0,
}

/** Income that can be counted on monthly. Variable sources contribute nothing until logged. */
export function monthlyIncome(state: AppState): number {
  return state.incomeSources
    .filter((s) => s.active)
    .reduce((sum, s) => sum + s.amount * PER_MONTH[s.frequency], 0)
}

/** Scheduled plans ending, with the monthly payment each one frees up. */
function freedCashTimeline(debts: Debt[]) {
  return activeDebts(debts)
    .filter((d) => d.product !== 'credit_card' && d.monthlyPayment)
    .map((d) => ({ debt: d, ends: projectedPayoffDate(d), frees: d.monthlyPayment ?? 0 }))
    .filter((x): x is { debt: Debt; ends: string; frees: number } => Boolean(x.ends))
    .sort((a, b) => a.ends.localeCompare(b.ends))
}

function months(n: number): string {
  if (n < 12) return `${n} month${n === 1 ? '' : 's'}`
  const y = Math.floor(n / 12)
  const m = n % 12
  return `${y} year${y === 1 ? '' : 's'}${m ? ` ${m} month${m === 1 ? '' : 's'}` : ''}`
}

/**
 * Findings computed from the actual figures — no model, no guessing. Each one
 * exists because it is something the numbers say but the screens do not.
 */
export function generateInsights(state: AppState, now = today()): Insight[] {
  const out: Insight[] = []
  const debts = activeDebts(state.debts)
  if (debts.length === 0) return out

  const rows = debts.map((d) => ({ debt: d, payoff: earlyPayoff(d) }))
  const interestBearing = rows
    .filter((r) => r.payoff.saved >= 0.01)
    .sort((a, b) => b.payoff.saved - a.payoff.saved)
  const zeroRate = rows.filter((r) => r.payoff.saved < 0.01 && r.debt.monthlyPayment)

  // Where an extra dollar does the most work.
  const top = interestBearing[0]
  if (top) {
    const share = top.payoff.saved / top.payoff.scheduled
    out.push({
      id: 'leverage',
      kind: 'opportunity',
      title: `Extra money works hardest on ${top.debt.name}`,
      detail:
        `Left alone it costs ${formatCurrency(top.payoff.scheduled)} to clear, of which ` +
        `${formatCurrency(top.payoff.saved)} is interest — ${Math.round(share * 100)}% of every ` +
        `dollar you put in. ${
          zeroRate.length > 0
            ? `The same dollar on your 0% plans saves nothing at all.`
            : `Nothing else you owe comes close.`
        }`,
      weight: 100,
    })
  }

  // 0% plans: no financial reason to rush.
  if (zeroRate.length > 0) {
    const total = zeroRate.reduce((s, r) => s + r.debt.balance, 0)
    out.push({
      id: 'zero-rate',
      kind: 'context',
      title: `${formatCurrency(total)} of your debt costs nothing to carry`,
      detail:
        `${zeroRate.map((r) => r.debt.name).join(', ')} are at 0%. Paying them early saves ` +
        `exactly nothing — the only reason to clear them sooner is to free up the monthly ` +
        `payment. If cash is tight, these are the ones to pay at their own pace.`,
      weight: 40,
    })
  }

  // Plans ending soon, and the monthly cash they release.
  const timeline = freedCashTimeline(state.debts)
  const soon = timeline.filter((t) => t.ends <= addDays(now, 90))
  if (soon.length > 0) {
    const frees = soon.reduce((s, t) => s + t.frees, 0)
    const last = soon[soon.length - 1]
    out.push({
      id: 'freed-cash',
      kind: 'milestone',
      title: `${formatCurrency(frees)}/month frees up by ${formatDate(last.ends)}`,
      detail:
        `${soon.length} plan${soon.length === 1 ? '' : 's'} finish${soon.length === 1 ? 'es' : ''} ` +
        `in the next three months: ${soon.map((t) => t.debt.name).join(', ')}. That is ` +
        `${formatCurrency(frees)} a month you are already used to paying, so redirecting it ` +
        `costs you nothing you are not already spending.`,
      weight: 90,
    })

    // Redirecting that freed payment is usually the single biggest lever available.
    const card = debts.find((d) => d.product === 'credit_card' && d.apr > 0 && d.monthlyPayment)
    if (card && card.monthlyPayment) {
      const base = estimatePayoffMonths(card.balance, card.apr, card.monthlyPayment)
      const boosted = estimatePayoffMonths(card.balance, card.apr, card.monthlyPayment + frees)
      if (base && boosted && boosted < base) {
        const savedNow = earlyPayoff(card).saved
        const savedThen = card.monthlyPayment + frees
        out.push({
          id: 'redirect',
          kind: 'opportunity',
          title: `Redirecting it would clear the ${card.name} ${months(base - boosted)} sooner`,
          detail:
            `At ${formatCurrency(card.monthlyPayment)}/month it takes ${months(base)} and costs ` +
            `${formatCurrency(savedNow)} in interest. Rolling the freed ${formatCurrency(frees)} ` +
            `into it — ${formatCurrency(savedThen)}/month — brings that down to ${months(boosted)}.`,
          weight: 95,
        })
      }
    }
  }

  // Near-term cash crunch.
  const due14 = dueWithin(state.debts, 14, now)
  if (due14 > 0 && state.bankBalance.amount < due14) {
    out.push({
      id: 'crunch',
      kind: 'warning',
      title: `${formatCurrency(due14)} due in 14 days against ${formatCurrency(state.bankBalance.amount)}`,
      detail:
        `You are ${formatCurrency(due14 - state.bankBalance.amount)} short of what falls due in ` +
        `the next fortnight. Cover the gap before putting anything extra toward a single debt.`,
      weight: 120,
    })
  }

  // How much of predictable income the minimums consume.
  const income = monthlyIncome(state)
  const minimums = totalMonthlyMinimum(state.debts)
  if (income > 0 && minimums > 0) {
    const share = minimums / income
    out.push({
      id: 'burden',
      kind: share > 0.4 ? 'warning' : 'context',
      title: `Minimum payments take ${Math.round(share * 100)}% of dependable income`,
      detail:
        `${formatCurrency(minimums)} a month in minimums against ${formatCurrency(income)} of ` +
        `income you can count on. That leaves ${formatCurrency(Math.max(income - minimums, 0))} ` +
        `for everything else${
          share > 0.4 ? ', which is tight — freelance or new income moves this the most.' : '.'
        }`,
      weight: share > 0.4 ? 85 : 35,
    })
  }

  // A pending windfall, priced against the debt it would best retire.
  const claim = state.pendingClaims[0]
  if (claim && top) {
    const target = interestBearing.find((r) => r.debt.product === 'credit_card') ?? top
    const applied = Math.min(claim.low, target.debt.balance)
    const card = target.debt
    if (card.monthlyPayment && card.apr > 0) {
      const before = estimatePayoffMonths(card.balance, card.apr, card.monthlyPayment)
      const after = estimatePayoffMonths(card.balance - applied, card.apr, card.monthlyPayment)
      // Interest is the difference between the two amortisations, not the payments
      // skipped — most of those were principal that the windfall paid instead.
      const interestAvoided =
        target.payoff.saved - earlyPayoff({ ...card, balance: card.balance - applied }).saved
      if (before && after && interestAvoided > 0) {
        out.push({
          id: 'windfall',
          kind: 'opportunity',
          title: `The ${claim.name} would buy more than its face value`,
          detail:
            `At the low end of ${formatCurrency(claim.low)}, putting it against the ${card.name} ` +
            `cuts the payoff from ${months(before)} to ${months(after)} and avoids about ` +
            `${formatCurrency(interestAvoided)} of interest — so it is effectively worth ` +
            `${formatCurrency(applied + interestAvoided)} to you.`,
          weight: 70,
        })
      }
    }
  }

  // The shape of the finish line.
  const lastScheduled = timeline[timeline.length - 1]
  if (lastScheduled) {
    out.push({
      id: 'finish',
      kind: 'milestone',
      title: `Every fixed plan is gone by ${formatDate(lastScheduled.ends)}`,
      detail:
        `${timeline.length} scheduled plan${timeline.length === 1 ? '' : 's'} run out between now ` +
        `and then, releasing ${formatCurrency(
          timeline.reduce((s, t) => s + t.frees, 0),
        )} a month in total. What remains after that is the card and anything informal.`,
      weight: 50,
    })
  }

  return out.sort((a, b) => b.weight - a.weight)
}
