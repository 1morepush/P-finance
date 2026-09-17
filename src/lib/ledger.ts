import type { AppState, Debt, LedgerEntry } from '../types'
import { uid } from './id'
import { today } from './schedule'

/**
 * A running tab with a person, kept line by line.
 *
 * The balance is the sum of the lines and nothing else. Storing a total beside
 * an itemised list is how the two come to disagree, and once they do there is
 * no way to tell which one is wrong — so here there is only ever one figure,
 * derived on demand.
 */
export function ledgerBalance(entries: LedgerEntry[]): number {
  // Rounded at each step: $7.19 twice and $50.95 once is exactly the kind of
  // arithmetic that leaves a balance reading 866.5399999999998.
  return entries.reduce((sum, e) => Math.round((sum + e.amount) * 100) / 100, 0)
}

export interface LedgerTotals {
  /** Everything that added to the tab. */
  charges: number
  /** Everything paid back or credited, as a positive figure. */
  payments: number
  balance: number
  count: number
  /** The most recent line, which is usually the one being asked about. */
  latest: LedgerEntry | null
}

export function ledgerTotals(entries: LedgerEntry[]): LedgerTotals {
  const charges = entries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0)
  const payments = entries.filter((e) => e.amount < 0).reduce((s, e) => s - e.amount, 0)
  return {
    charges: Math.round(charges * 100) / 100,
    payments: Math.round(payments * 100) / 100,
    balance: ledgerBalance(entries),
    count: entries.length,
    latest: entries.length ? entries[entries.length - 1] : null,
  }
}

/** Each line with the tab's total as it stood after it — how a tab is read. */
export function withRunningTotal(entries: LedgerEntry[]): { entry: LedgerEntry; running: number }[] {
  let running = 0
  return entries.map((entry) => {
    running = Math.round((running + entry.amount) * 100) / 100
    return { entry, running }
  })
}

export type LedgerInput = Omit<LedgerEntry, 'id'>

function writeLedger(state: AppState, debtId: string, entries: LedgerEntry[]): AppState {
  const balance = ledgerBalance(entries)
  return {
    ...state,
    debts: state.debts.map((d) =>
      d.id === debtId
        ? {
            ...d,
            ledger: entries,
            balance,
            // A tab settled to nothing is paid off like any other debt; one that
            // goes back above zero is owed again.
            status: balance <= 0 ? 'paid' : d.status === 'paid' ? 'active' : d.status,
          }
        : d,
    ),
  }
}

/**
 * Adds a line and moves the balance with it. A payment that left the bank moves
 * that too, since handing someone cash is money gone whatever the tab says.
 */
export function addLedgerEntry(state: AppState, debtId: string, input: LedgerInput): AppState {
  const debt = state.debts.find((d) => d.id === debtId)
  if (!debt || input.amount === 0) return state

  const entry: LedgerEntry = { ...input, id: uid() }
  const next = writeLedger(state, debtId, [...(debt.ledger ?? []), entry])
  return input.fromBank
    ? {
        ...next,
        bankBalance: {
          amount: Math.round((next.bankBalance.amount + input.amount) * 100) / 100,
          updatedAt: input.date,
        },
      }
    : next
}

/** Removes a line, putting back anything it took out of the bank. */
export function removeLedgerEntry(state: AppState, debtId: string, entryId: string): AppState {
  const debt = state.debts.find((d) => d.id === debtId)
  const entry = debt?.ledger?.find((e) => e.id === entryId)
  if (!debt || !entry) return state

  const next = writeLedger(
    state,
    debtId,
    debt.ledger!.filter((e) => e.id !== entryId),
  )
  return entry.fromBank
    ? {
        ...next,
        bankBalance: {
          ...next.bankBalance,
          amount: Math.round((next.bankBalance.amount - entry.amount) * 100) / 100,
        },
      }
    : next
}

/** Corrects a line in place — a mistyped figure, or the note that was never added. */
export function updateLedgerEntry(
  state: AppState,
  debtId: string,
  entryId: string,
  input: LedgerInput,
): AppState {
  const debt = state.debts.find((d) => d.id === debtId)
  const before = debt?.ledger?.find((e) => e.id === entryId)
  if (!debt || !before) return state

  const next = writeLedger(
    state,
    debtId,
    debt.ledger!.map((e) => (e.id === entryId ? { ...input, id: entryId } : e)),
  )
  // Whatever the old line did to the bank is undone and the new one applied.
  const bankDelta =
    (input.fromBank ? input.amount : 0) - (before.fromBank ? before.amount : 0)
  return bankDelta === 0
    ? next
    : {
        ...next,
        bankBalance: {
          amount: Math.round((next.bankBalance.amount + bankDelta) * 100) / 100,
          updatedAt: input.date,
        },
      }
}

/**
 * Brings a tab to a stated total by writing the difference as its own line.
 *
 * Setting the balance by hand on a debt that has a ledger would otherwise put
 * the two out of step. Recording the gap as an adjustment keeps the sum honest
 * and leaves a visible note of the correction rather than a silent one.
 */
export function reconcileToBalance(
  state: AppState,
  debtId: string,
  target: number,
  date = today(),
  note = 'Adjusted to a stated balance',
): AppState {
  const debt = state.debts.find((d) => d.id === debtId)
  if (!debt?.ledger) return state
  const gap = Math.round((target - ledgerBalance(debt.ledger)) * 100) / 100
  if (gap === 0) return state
  return addLedgerEntry(state, debtId, { date, amount: gap, note })
}

export interface LedgerMismatch {
  debt: Debt
  balance: number
  fromLedger: number
}

/**
 * Debts whose stored balance has come apart from their own lines. Nothing in
 * the app should be able to cause this; it exists so that if something does,
 * it is visible rather than quietly wrong.
 */
export function ledgerMismatches(debts: Debt[]): LedgerMismatch[] {
  return debts.flatMap((debt) => {
    if (!debt.ledger) return []
    const fromLedger = ledgerBalance(debt.ledger)
    if (Math.abs(fromLedger - debt.balance) < 0.005) return []
    return [{ debt, balance: debt.balance, fromLedger }]
  })
}

/** Debts kept as a tab with a person, biggest first. */
export function tabs(debts: Debt[]): Debt[] {
  return debts
    .filter((d) => d.ledger && d.status !== 'paid')
    .sort((a, b) => b.balance - a.balance)
}
