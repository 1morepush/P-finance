import type { AppState, PendingOutflow } from '../types'
import { uid } from './id'
import { today } from './schedule'

/**
 * Payments sent but not yet out of the bank.
 *
 * `bankBalance` stays what is really there: a payment comes off it the moment
 * it is sent. Until the bank catches up, its own app shows more than that by
 * the total of these. Keeping the list is what lets the two figures be told
 * apart, in both directions — reading the app against the bank, and typing
 * the bank's figure into the app.
 */
export function pendingOf(state: AppState): PendingOutflow[] {
  return state.pendingOutflows ?? []
}

export function pendingTotal(state: AppState): number {
  return Math.round(pendingOf(state).reduce((n, o) => n + o.amount, 0) * 100) / 100
}

/** What the bank's own app should be showing right now. */
export function statementBalance(state: AppState): number {
  return Math.round((state.bankBalance.amount + pendingTotal(state)) * 100) / 100
}

/**
 * Sets the balance from the figure the bank shows. Whatever has not posted is
 * still in that figure, so it comes off to give what is really there.
 */
export function setBankFromStatement(state: AppState, shown: number, now = today()): AppState {
  return {
    ...state,
    bankBalance: { amount: Math.round((shown - pendingTotal(state)) * 100) / 100, updatedAt: now },
  }
}

/** Something sent outside the payment log — a transfer, a bill — not yet out of the bank. */
export function addPending(state: AppState, label: string, amount: number, now = today()): AppState {
  if (!(amount > 0) || !label.trim()) return state
  const amt = Math.round(amount * 100) / 100
  return {
    ...state,
    bankBalance: { amount: Math.round((state.bankBalance.amount - amt) * 100) / 100, updatedAt: now },
    pendingOutflows: [...pendingOf(state), { id: uid(), label: label.trim(), amount: amt, date: now }],
  }
}

/** The bank has taken it. The balance already had it off, so only the list changes. */
export function markPosted(state: AppState, id: string): AppState {
  return { ...state, pendingOutflows: pendingOf(state).filter((o) => o.id !== id) }
}

/** It never went out after all: the money goes back and the line goes. */
export function cancelPending(state: AppState, id: string): AppState {
  const item = pendingOf(state).find((o) => o.id === id)
  if (!item) return state
  return {
    ...state,
    bankBalance: { ...state.bankBalance, amount: Math.round((state.bankBalance.amount + item.amount) * 100) / 100 },
    pendingOutflows: pendingOf(state).filter((o) => o.id !== id),
  }
}
