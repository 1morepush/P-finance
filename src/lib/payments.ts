import type { AppState, Debt, Payment } from '../types'
import { PAYMENT_CADENCE, addDays, addMonths, isDate } from './schedule'

export interface PaymentInput {
  debtId: string
  amount: number
  date: string
  /** Deduct from the bank balance too (the money actually left the account). */
  fromBank: boolean
  /** Roll the debt's due date forward one billing cycle. */
  advanceDue: boolean
}

/** The due date one billing cycle on, or null if the debt has no dated schedule. */
export function nextDueAfter(debt: Debt): string | null {
  const cadence = PAYMENT_CADENCE[debt.product]
  if (!cadence || !isDate(debt.nextDue)) return null
  return cadence === 'biweekly' ? addDays(debt.nextDue, 14) : addMonths(debt.nextDue, 1)
}

/**
 * Records a payment and applies every consequence at once: the debt's balance
 * falls, the bank balance follows if the money left the account, the due date
 * rolls forward, and a debt paid to zero moves into the cleared log.
 *
 * Everything needed to reverse this is stored on the Payment record, so
 * `undoPayment` can restore the exact prior state.
 */
export function applyPayment(state: AppState, input: PaymentInput): AppState {
  const debt = state.debts.find((d) => d.id === input.debtId)
  if (!debt || input.amount <= 0) return state

  const applied = Math.min(input.amount, debt.balance)
  const remaining = Math.max(debt.balance - applied, 0)
  const clears = remaining === 0
  const advanced = input.advanceDue && !clears ? nextDueAfter(debt) : null

  const payment: Payment = {
    id: crypto.randomUUID(),
    debtId: debt.id,
    debtName: debt.name,
    amount: applied,
    date: input.date,
    fromBank: input.fromBank,
    clearedDebt: clears,
    ...(advanced ? { previousNextDue: debt.nextDue } : {}),
  }

  return {
    ...state,
    bankBalance: input.fromBank
      ? { amount: state.bankBalance.amount - applied, updatedAt: input.date }
      : state.bankBalance,
    debts: state.debts.map((d) =>
      d.id === debt.id
        ? {
            ...d,
            balance: remaining,
            status: clears ? 'paid' : d.status,
            ...(advanced ? { nextDue: advanced } : {}),
          }
        : d,
    ),
    clearedDebts: clears
      ? [
          ...state.clearedDebts,
          {
            id: debt.id,
            name: debt.name,
            product: debt.product,
            // The balance that was still outstanding, matching how the rest of
            // the cleared log is recorded.
            amountCleared: debt.balance,
            dateCleared: input.date,
          },
        ]
      : state.clearedDebts,
    payments: [...state.payments, payment],
  }
}

/** Reverses a logged payment, restoring balance, bank, due date and cleared status. */
export function undoPayment(state: AppState, paymentId: string): AppState {
  const payment = state.payments.find((p) => p.id === paymentId)
  if (!payment) return state

  return {
    ...state,
    bankBalance: payment.fromBank
      ? { ...state.bankBalance, amount: state.bankBalance.amount + payment.amount }
      : state.bankBalance,
    debts: state.debts.map((d) =>
      d.id === payment.debtId
        ? {
            ...d,
            balance: d.balance + payment.amount,
            status: payment.clearedDebt ? 'active' : d.status,
            ...(payment.previousNextDue ? { nextDue: payment.previousNextDue } : {}),
          }
        : d,
    ),
    clearedDebts: payment.clearedDebt
      ? state.clearedDebts.filter((c) => c.id !== payment.debtId)
      : state.clearedDebts,
    payments: state.payments.filter((p) => p.id !== paymentId),
  }
}

/** Total logged against one debt. */
export function totalPaidToward(state: AppState, debtId: string): number {
  return state.payments.filter((p) => p.debtId === debtId).reduce((s, p) => s + p.amount, 0)
}
