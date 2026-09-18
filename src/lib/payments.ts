import type { AppState, Debt, LedgerEntry, Payment } from '../types'
import { activeDebts } from './finance'
import { PAYMENT_CADENCE, addDays, addMonths, isDate, today } from './schedule'
import { uid } from './id'

export interface PaymentInput {
  debtId: string
  amount: number
  date: string
  /** Deduct from the bank balance too (the money actually left the account). */
  fromBank: boolean
  /** Roll the debt's due date forward one billing cycle. */
  advanceDue: boolean
  /** Settled automatically because the due date passed. */
  auto?: boolean
  /**
   * Apply every consequence but leave no Payment behind. Only for settling an
   * instalment the log already holds — see `settleOverduePayments`. Defaults to
   * recording, which is what every ordinary payment wants.
   */
  record?: boolean
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

  // A debt kept as a running tab has to hear about this, or its lines and its
  // balance start disagreeing — the tab's own sum is what the balance means.
  const ledgerEntry: LedgerEntry | null = debt.ledger
    ? { id: uid(), date: input.date, amount: -applied, note: 'Payment', fromBank: input.fromBank }
    : null

  const payment: Payment = {
    id: uid(),
    debtId: debt.id,
    debtName: debt.name,
    amount: applied,
    date: input.date,
    fromBank: input.fromBank,
    clearedDebt: clears,
    ...(advanced ? { previousNextDue: debt.nextDue } : {}),
    ...(input.auto ? { auto: true } : {}),
    ...(ledgerEntry ? { ledgerEntryId: ledgerEntry.id } : {}),
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
            ...(ledgerEntry ? { ledger: [...(d.ledger ?? []), ledgerEntry] } : {}),
          }
        : d,
    ),
    // The `some` guard matters when a seed update has reset a debt that the
    // cleared log already holds: clearing it again must not list it twice.
    clearedDebts:
      clears && !state.clearedDebts.some((c) => c.id === debt.id)
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
    payments: input.record === false ? state.payments : [...state.payments, payment],
  }
}

/**
 * Reverses a logged payment, restoring balance, bank, due date and cleared status.
 *
 * Undoing has to survive a reload. Restoring a due date that has already gone by
 * puts the instalment right back in `settleOverduePayments`' path, and the next
 * time the app opens it would be settled again — silently undoing the undo. So a
 * debt whose restored date is in the past stops being assumed: `autoMarkPaid`
 * goes false, which is exactly what the user just said by reversing it, and the
 * instalment surfaces in the overdue block instead of vanishing again.
 */
export function undoPayment(state: AppState, paymentId: string, todayISO = today()): AppState {
  const payment = state.payments.find((p) => p.id === paymentId)
  if (!payment) return state

  // The date the debt is left sitting on once this is reversed. A payment that
  // cleared a debt never advanced anything, so it stores no previous date and
  // the debt keeps the one it already has — which is just as much in the past.
  const debt = state.debts.find((d) => d.id === payment.debtId)
  // Nothing to put the money back onto. Refunding the bank alone would conjure
  // cash out of a debt that no longer exists; the record stays as history.
  if (!debt) return state
  const restoredDue = payment.previousNextDue ?? debt.nextDue
  const restoresPastDue = isDate(restoredDue) && restoredDue < todayISO

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
            ...(restoresPastDue ? { autoMarkPaid: false } : {}),
            // The line this payment wrote on the tab goes with it.
            ...(payment.ledgerEntryId && d.ledger
              ? { ledger: d.ledger.filter((e) => e.id !== payment.ledgerEntryId) }
              : {}),
          }
        : d,
    ),
    clearedDebts: payment.clearedDebt
      ? state.clearedDebts.filter((c) => c.id !== payment.debtId)
      : state.clearedDebts,
    payments: state.payments.filter((p) => p.id !== paymentId),
  }
}

/** A payment whose debt has since been deleted — history, but not reversible. */
export function isOrphaned(state: AppState, payment: Payment): boolean {
  return !state.debts.some((d) => d.id === payment.debtId)
}

/**
 * Re-applies payments entered by hand on or after `since` to the current
 * balances, without logging them again and without touching the bank.
 *
 * For a figures update: the new table carries what the lender knew on its own
 * date, so a payment made after that is not in it. Its record and its bank
 * deduction survived the update; its effect on the balance did not, and the
 * money had simply gone missing between the two.
 *
 * A payment that advanced a due date moves it again only when the fresh figure
 * is sitting on exactly the date that was paid — one step, no guessing. Auto
 * settlements are left to `settleOverduePayments`, which already recognises
 * instalments it has logged.
 */
export function replayManualPayments(state: AppState, since: string): AppState {
  let next = state
  const replay = state.payments
    .filter((p) => !p.auto && p.date >= since)
    .sort((a, b) => a.date.localeCompare(b.date))

  for (const p of replay) {
    const debt = next.debts.find((d) => d.id === p.debtId)
    if (!debt || debt.balance <= 0) continue
    const advance = Boolean(p.previousNextDue) && debt.nextDue === p.previousNextDue
    next = applyPayment(next, {
      debtId: debt.id,
      amount: p.amount,
      date: p.date,
      fromBank: false,
      advanceDue: advance,
      record: false,
    })
  }
  return next
}

/**
 * Records today's active total, once per day. The progress chart draws from
 * these where they exist rather than reconstructing the past from the payment
 * log — a balance corrected by hand never appears in the log at all, and a
 * duplicated record inflated the reconstruction while the total on screen was
 * right the whole time.
 */
export function recordSnapshot(state: AppState, todayISO = today()): AppState {
  const total = activeDebts(state.debts).reduce((s, d) => s + d.balance, 0)
  const last = state.snapshots[state.snapshots.length - 1]
  if (last && last.date === todayISO) {
    return Math.abs(last.total - total) < 0.005
      ? state
      : { ...state, snapshots: [...state.snapshots.slice(0, -1), { date: todayISO, total }] }
  }
  // Two years is plenty for a chart; older days are already summarised by the
  // reconstruction anyway.
  const kept = [...state.snapshots, { date: todayISO, total }].slice(-730)
  return { ...state, snapshots: kept }
}

export interface AutoSettlement {
  debtId: string
  debtName: string
  count: number
  total: number
  cleared: boolean
}

/**
 * Settles every scheduled payment whose due date has passed, on the assumption
 * that it went through — the common case, since these plans are on autopay.
 *
 * Deliberately does NOT touch the bank balance: that figure is typed in from
 * the real account, which already reflects any payment that actually cleared,
 * so deducting again would double-count. Each settlement is recorded as an
 * ordinary payment, so anything that did not go through can simply be undone.
 *
 * Skips debts flagged `autoMarkPaid: false`. Idempotent — once the due date has
 * been rolled past today there is nothing left to settle.
 *
 * Idempotent against the payment log too, not just against the debt's own due
 * date. A seed update replaces the debts with the source table's pre-settle
 * figures while deliberately keeping the history, so every instalment this has
 * already recorded looks overdue all over again. Where the log already holds an
 * instalment, its effect is applied without logging it a second time.
 */
export function settleOverduePayments(
  state: AppState,
  todayISO = today(),
): { state: AppState; settled: AutoSettlement[] } {
  let next = state
  const settled: AutoSettlement[] = []
  const alreadyLogged = new Set(state.payments.map((p) => `${p.debtId}|${p.date}`))

  for (const original of activeDebts(state.debts)) {
    if (original.autoMarkPaid === false) continue
    if (!PAYMENT_CADENCE[original.product] || !original.monthlyPayment) continue

    let count = 0
    let total = 0
    // Catch up one cycle at a time, in case several were missed.
    for (let guard = 0; guard < 120; guard++) {
      const debt = next.debts.find((d) => d.id === original.id)
      if (!debt || debt.balance <= 0 || !isDate(debt.nextDue) || debt.nextDue >= todayISO) break
      const amount = Math.min(debt.monthlyPayment ?? 0, debt.balance)
      if (amount <= 0) break
      // Already in the log from a settle that ran before the figures were
      // replaced. Move the balance and the due date on, but do not log it again
      // or report it as newly settled — nothing new has happened.
      const seen = alreadyLogged.has(`${debt.id}|${debt.nextDue}`)
      next = applyPayment(next, {
        debtId: debt.id,
        amount,
        date: debt.nextDue,
        fromBank: false,
        advanceDue: true,
        auto: true,
        ...(seen ? { record: false } : {}),
      })
      if (!seen) {
        count += 1
        total += amount
      }
    }

    if (count > 0) {
      const after = next.debts.find((d) => d.id === original.id)
      settled.push({
        debtId: original.id,
        debtName: original.name,
        count,
        total,
        cleared: (after?.balance ?? 0) <= 0,
      })
    }
  }

  return { state: next, settled }
}

export interface Dedupe {
  removed: number
  amount: number
  /** Debt names involved, each once, for saying what was cleaned up. */
  names: string[]
}

/**
 * Removes auto-settlements that record the same instalment more than once, and
 * cleared debts listed twice.
 *
 * Accepting a seed update reset the debts to the source table's pre-settle
 * figures while keeping the history, so the next load settled every overdue
 * instalment a second time. The balances stayed right — they were reset and
 * re-settled — but the payment log grew a duplicate each time, which inflated
 * everything derived from it: the progress chart's starting total, how much has
 * been paid off, and the monthly rate the payoff estimate is built on.
 *
 * Only `auto` records are removed, and only where the debt and the date both
 * match a payment already kept — automatic or entered by hand. An
 * auto-settlement is the app's own restatement of a schedule, never something
 * typed in, and one instalment cannot fall due twice on one day, so a match is
 * always a duplicate. Payments entered by hand are never removed, however much
 * they look alike: two real payments on one debt on one day is a thing a person
 * can genuinely do.
 *
 * A manual record counting as a match is the whole point of the second pass:
 * marking a due date paid from the Calendar writes one, and the settle after
 * the next figures update then wrote its own copy alongside it.
 */
export function dedupeSettlements(state: AppState): { state: AppState; dedupe: Dedupe } {
  const key = (p: Payment) => `${p.debtId}|${p.date}`

  // An instalment already covered by a payment entered by hand needs no
  // assumption on top of it. Marking a due date paid from the Calendar creates
  // exactly that: a manual record the next settle then duplicates. So the
  // grouping runs over every payment, not just the automatic ones — keying only
  // off `auto` meant a manual record never claimed its instalment, and the
  // automatic copy that followed went unnoticed.
  const byHand = new Set(state.payments.filter((p) => !p.auto).map(key))

  const kept: Payment[] = []
  const keptAuto = new Set<string>()
  const names = new Set<string>()
  let removed = 0
  let amount = 0

  for (const p of state.payments) {
    const k = key(p)
    // Never removed, however alike two of them look: two real payments on one
    // debt on one day is something a person can genuinely do.
    if (!p.auto) {
      kept.push(p)
      continue
    }
    if (byHand.has(k) || keptAuto.has(k)) {
      removed += 1
      amount += p.amount
      names.add(p.debtName)
      continue
    }
    keptAuto.add(k)
    kept.push(p)
  }

  const clearedIds = new Set<string>()
  const clearedDebts = state.clearedDebts.filter((c) => {
    if (clearedIds.has(c.id)) return false
    clearedIds.add(c.id)
    return true
  })

  const unchanged = removed === 0 && clearedDebts.length === state.clearedDebts.length
  return {
    state: unchanged ? state : { ...state, payments: kept, clearedDebts },
    dedupe: { removed, amount, names: [...names] },
  }
}

/** Total logged against one debt. */
export function totalPaidToward(state: AppState, debtId: string): number {
  return state.payments.filter((p) => p.debtId === debtId).reduce((s, p) => s + p.amount, 0)
}
