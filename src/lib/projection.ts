import type { AppState } from '../types'
import { dueItems } from './calendar'
import { expectedPay, paydaysBetween } from './payday'
import { addDays, startOfWeek, today } from './schedule'

export interface WeekBalance {
  /** The Sunday the week starts on. */
  week: string
  /** The Saturday it ends on. */
  end: string
  /** What the bank should hold at the end of Saturday. */
  balance: number
  /** Paychecks counted up to that Saturday. */
  paychecks: number
  /** Whether pay is in the figure — false when no pay has been entered yet. */
  includesPay: boolean
}

/**
 * The bank balance carried forward week by week: today's figure, less every
 * confirmed payment still to come out (anything past due and unpaid first),
 * plus each paycheck on its payday. Unconfirmed debts are left out, as from
 * every total. Planned costs count at the top of their range.
 *
 * A payday today counts only if the balance was entered before today — once
 * it has been updated today, the deposit is assumed to be in it already.
 */
export function weekEndBalances(state: AppState, weeks = 12, now = today()): WeekBalance[] {
  const items = dueItems(state, false, now).filter((p) => !p.isPotential)
  const pay = expectedPay(state)
  const firstPay = state.bankBalance.updatedAt >= now ? addDays(now, 1) : now
  const out: WeekBalance[] = []
  let week = startOfWeek(now)
  for (let i = 0; i < weeks; i++) {
    const end = addDays(week, 6)
    const out_ = items.filter((p) => p.date <= end).reduce((n, p) => n + p.amount, 0)
    const checks = pay !== null ? paydaysBetween(state, firstPay, end).length : 0
    out.push({
      week,
      end,
      balance: Math.round((state.bankBalance.amount - out_ + checks * (pay ?? 0)) * 100) / 100,
      paychecks: checks,
      includesPay: pay !== null,
    })
    week = addDays(week, 7)
  }
  return out
}
