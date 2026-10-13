import type { AppState, PlannedCost } from '../types'
import type { ScheduledPayment } from './schedule'
import { today } from './schedule'
import { fundsOf, isDone, spendFromFund, toggleTask } from './recovery'

/** The car's sinking fund, which these costs are what it is for. */
export const CAR_FUND = 'fund-car'

export function plannedCostsOf(state: AppState): PlannedCost[] {
  return state.plannedCosts ?? []
}

export function isPaid(cost: PlannedCost): boolean {
  return cost.status === 'paid'
}

/** Overdue by its own flag, or because its day has gone by unpaid. */
export function isOverdue(cost: PlannedCost, now = today()): boolean {
  return !isPaid(cost) && (cost.status === 'overdue' || cost.due < now)
}

/** The cost it is waiting on, while that one is still unpaid. */
export function blockedBy(costs: PlannedCost[], cost: PlannedCost): PlannedCost | undefined {
  const before = cost.needs ? costs.find((c) => c.id === cost.needs) : undefined
  return before && !isPaid(before) ? before : undefined
}

/**
 * Unpaid costs as payments on their due day, at the top of their range. A
 * cost whose day has passed stays on that day rather than rolling forward —
 * unlike a subscription it does not happen on its own, so a past date means
 * it is still to do.
 */
export function plannedPayments(costs: PlannedCost[], from?: string, until?: string): ScheduledPayment[] {
  return costs
    .filter((c) => !isPaid(c) && c.high > 0)
    .filter((c) => (from === undefined || c.due >= from) && (until === undefined || c.due <= until))
    .map((c) => ({
      debtId: `cost:${c.id}`,
      debtName: c.name,
      product: 'bill' as const,
      date: c.due,
      amount: c.high,
      isFinal: false,
      isPotential: false,
      ...(c.low !== c.high ? { estimateLow: c.low } : {}),
    }))
}

function update(state: AppState, id: string, patch: (c: PlannedCost) => PlannedCost): AppState {
  return { ...state, plannedCosts: plannedCostsOf(state).map((c) => (c.id === id ? patch(c) : c)) }
}

/**
 * Pays a cost: from checking, which lowers the bank balance, or from the car
 * fund, which does not. The fund is never taken below zero — whatever it
 * cannot cover comes from checking. Ticks the plan's to-do for it too.
 */
export function payPlannedCost(
  state: AppState,
  id: string,
  amount: number,
  from: 'checking' | 'car fund',
  on = today(),
): AppState {
  const cost = plannedCostsOf(state).find((c) => c.id === id)
  if (!cost || isPaid(cost) || !Number.isFinite(amount) || amount <= 0) return state
  const amt = Math.round(amount * 100) / 100
  const fund = fundsOf(state).find((f) => f.id === CAR_FUND)?.balance ?? 0
  const fromFund = from === 'car fund' ? Math.min(amt, Math.max(fund, 0)) : 0
  const fromBank = Math.round((amt - fromFund) * 100) / 100
  let next = update(state, id, (c) => ({
    ...c,
    status: 'paid',
    paidAmount: amt,
    paidOn: on,
    paidFrom: from,
    ...(fromFund > 0 ? { paidFromFund: fromFund } : {}),
  }))
  if (fromFund > 0) next = spendFromFund(next, CAR_FUND, fromFund)
  if (fromBank > 0)
    next = { ...next, bankBalance: { amount: Math.round((next.bankBalance.amount - fromBank) * 100) / 100, updatedAt: on } }
  if (cost.planTask && !isDone(next, cost.planTask)) next = toggleTask(next, cost.planTask, on)
  return next
}

/**
 * Takes a payment back: the money returns where it came from, and the cost is
 * due again. The plan's to-do is left as it is — it may have been ticked by
 * hand, and it is the person's to untick.
 */
export function unpayPlannedCost(state: AppState, id: string, now = today()): AppState {
  const cost = plannedCostsOf(state).find((c) => c.id === id)
  if (!cost || !isPaid(cost)) return state
  const amt = cost.paidAmount ?? 0
  let next = update(state, id, (c) => {
    const back: PlannedCost = { ...c, status: c.due < now ? 'overdue' : 'pending' }
    delete back.paidAmount
    delete back.paidOn
    delete back.paidFrom
    delete back.paidFromFund
    return back
  })
  const fromFund = cost.paidFromFund ?? 0
  const fromBank = Math.round((amt - fromFund) * 100) / 100
  if (fromFund > 0)
    next = {
      ...next,
      funds: fundsOf(next).map((f) =>
        f.id === CAR_FUND ? { ...f, balance: Math.round((f.balance + fromFund) * 100) / 100 } : f,
      ),
    }
  if (fromBank > 0)
    next = { ...next, bankBalance: { ...next.bankBalance, amount: Math.round((next.bankBalance.amount + fromBank) * 100) / 100 } }
  return next
}

/**
 * Figures-update rule: the supplied costs are refreshed, but a payment made
 * on this device is kept — the figures cannot know it happened. Costs added
 * on the device are kept as they are.
 */
export function mergePlannedCosts(device: PlannedCost[] | undefined, seeded: PlannedCost[]): PlannedCost[] {
  const mine = new Map((device ?? []).map((c) => [c.id, c]))
  const seededIds = new Set(seeded.map((c) => c.id))
  return [
    ...seeded.map((c) => {
      const here = mine.get(c.id)
      return here && isPaid(here)
        ? {
            ...c,
            status: 'paid' as const,
            paidAmount: here.paidAmount,
            paidOn: here.paidOn,
            paidFrom: here.paidFrom,
            ...(here.paidFromFund ? { paidFromFund: here.paidFromFund } : {}),
          }
        : c
    }),
    ...(device ?? []).filter((c) => !seededIds.has(c.id)),
  ]
}
