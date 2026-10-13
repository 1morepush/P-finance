import type { AppState } from '../types'
import { DEFAULT_PAYCHECK, estimatePaycheck } from './paycheck'
import { addDays, addMonths, isDate, today } from './schedule'

const FEDEX_SOURCE_ID = 'income-fedex'

/** The first payday on or after `now`, counted on from any known one. */
export function nextPayday(state: AppState, now = today()): string | null {
  const pay = state.paycheck
  const anchor = pay?.nextPayday ?? DEFAULT_PAYCHECK.nextPayday
  if (!isDate(anchor)) return null
  const frequency = pay?.frequency ?? DEFAULT_PAYCHECK.frequency
  const step = (n: number) =>
    frequency === 'monthly' ? addMonths(anchor, n) : addDays(anchor, (frequency === 'biweekly' ? 14 : 7) * n)
  // Walk back if the anchor is in the future, forward if it has passed.
  let n = 0
  while (step(n - 1) >= now) n--
  while (step(n) < now) n++
  return step(n)
}

/** Every payday from `now` through `until`, inclusive. */
export function paydaysBetween(state: AppState, now: string, until: string): string[] {
  const out: string[] = []
  let d = nextPayday(state, now)
  while (d && d <= until && out.length < 60) {
    out.push(d)
    d = nextPayday(state, addDays(d, 1))
  }
  return out
}

/**
 * What one paycheck brings in: the FedEx income figure where one is saved —
 * swapped for the paystub's when known — else the estimate from the hourly
 * rate. Null when neither has been entered, rather than a guess.
 */
export function expectedPay(state: AppState): number | null {
  const source = state.incomeSources.find((s) => s.id === FEDEX_SOURCE_ID && s.active)
  if (source && source.amount > 0) return source.amount
  const net = state.paycheck ? estimatePaycheck(state.paycheck).net : 0
  return net > 0 ? net : null
}
