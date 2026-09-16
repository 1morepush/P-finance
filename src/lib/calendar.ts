import type { AppState, ClearedDebt, DebtCategory, DebtProduct } from '../types'
import { PRODUCT_LABEL, categoryOfProduct } from '../types'
import { allPayments, type ScheduledPayment } from './schedule'

/**
 * One row on the calendar: either money already gone, or money still coming.
 *
 * The projection in ./schedule only runs forward from each debt's `nextDue`, so
 * the moment a payment is made its date rolls on and the instalment vanishes
 * from the calendar entirely — the record of it lives in `state.payments`, which
 * the calendar never looked at. Merging the two is what gives a past month
 * anything to show.
 */
export interface CalendarEntry {
  /** Stable React key, unique across both sources. */
  key: string
  date: string
  debtId: string
  debtName: string
  amount: number
  /** `paid` is recorded history; `due` is still projected. */
  kind: 'paid' | 'due'
  category: DebtCategory
  label: string
  /** From an unconfirmed debt — shown, but kept out of confirmed totals. */
  isPotential: boolean
  /** The last payment of a plan (projected), or the one that finished it (paid). */
  isFinal: boolean
  /** Settled automatically because its due date passed, rather than entered by hand. */
  auto: boolean
  /** The money left the bank balance too. */
  fromBank: boolean
  /**
   * Present only where the entry is a logged payment. Debts cleared before the
   * app existed have a record but no payment to undo.
   */
  paymentId?: string
  /**
   * Whether undoing is possible: a logged payment whose debt still exists. A
   * payment outliving its debt is history — there is nothing to put the money
   * back onto, so the calendar shows it and offers no button.
   */
  reversible: boolean
  /** The underlying projection, so a due entry can be marked paid in place. */
  scheduled?: ScheduledPayment
}

/** Cleared debts recorded before the app existed carry a coarser product name. */
type AnyProduct = ClearedDebt['product']

const LEGACY_CATEGORY: Partial<Record<string, DebtCategory>> = {
  paypal: 'installment',
  klarna: 'installment',
  affirm: 'installment',
}

const LEGACY_LABEL: Partial<Record<string, string>> = {
  paypal: 'PayPal',
  klarna: 'Klarna',
  affirm: 'Affirm',
}

function categoryOfAny(product: AnyProduct): DebtCategory {
  return LEGACY_CATEGORY[product] ?? categoryOfProduct(product as DebtProduct)
}

function labelOfAny(product: AnyProduct): string {
  return LEGACY_LABEL[product] ?? PRODUCT_LABEL[product as DebtProduct]
}

/**
 * Everything already paid, from the payment log plus the cleared debts that
 * predate it.
 *
 * A payment that zeroed a debt is in both places — the final payment and the
 * cleared entry are the same money — so a cleared debt only contributes a row
 * when no logged payment claims it. Same guard the progress chart uses.
 */
export function paidEntries(state: AppState): CalendarEntry[] {
  const claimed = new Set(state.payments.filter((p) => p.clearedDebt).map((p) => p.debtId))

  const productOf = (debtId: string): AnyProduct | undefined =>
    state.debts.find((d) => d.id === debtId)?.product ??
    state.clearedDebts.find((c) => c.id === debtId)?.product
  const stillExists = new Set(state.debts.map((d) => d.id))

  const logged: CalendarEntry[] = state.payments.map((p) => {
    const product = productOf(p.debtId)
    return {
      key: `paid:${p.id}`,
      date: p.date,
      debtId: p.debtId,
      debtName: p.debtName,
      amount: p.amount,
      kind: 'paid',
      category: product ? categoryOfAny(product) : 'installment',
      label: product ? labelOfAny(product) : 'Payment',
      isPotential: false,
      isFinal: p.clearedDebt,
      auto: p.auto === true,
      fromBank: p.fromBank,
      paymentId: p.id,
      reversible: stillExists.has(p.debtId),
    }
  })

  const preApp: CalendarEntry[] = state.clearedDebts
    .filter((c) => !claimed.has(c.id))
    .map((c) => ({
      key: `cleared:${c.id}`,
      date: c.dateCleared,
      debtId: c.id,
      debtName: c.name,
      amount: c.amountCleared,
      kind: 'paid',
      category: categoryOfAny(c.product),
      label: labelOfAny(c.product),
      isPotential: false,
      isFinal: true,
      auto: false,
      // Settled before the app was tracking the bank balance, so it never
      // moved that figure and undoing it could not put the money back.
      fromBank: false,
      reversible: false,
    }))

  return [...logged, ...preApp]
}

/** Everything still scheduled, as projected from each debt's remaining balance. */
export function dueEntries(state: AppState, includePotential = true): CalendarEntry[] {
  return allPayments(state.debts, includePotential).map((p) => ({
    key: `due:${p.debtId}:${p.date}`,
    date: p.date,
    debtId: p.debtId,
    debtName: p.debtName,
    amount: p.amount,
    kind: 'due',
    category: categoryOfProduct(p.product),
    label: PRODUCT_LABEL[p.product],
    isPotential: p.isPotential,
    isFinal: p.isFinal,
    auto: false,
    fromBank: false,
    reversible: false,
    scheduled: p,
  }))
}

/** Both halves of the calendar, earliest first, paid before due on a shared day. */
export function calendarEntries(state: AppState, includePotential = true): CalendarEntry[] {
  return [...paidEntries(state), ...dueEntries(state, includePotential)].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      // Within a day, what happened comes before what is still owed.
      Number(a.kind === 'due') - Number(b.kind === 'due') ||
      a.debtName.localeCompare(b.debtName),
  )
}

export function entriesOn(entries: CalendarEntry[], date: string): CalendarEntry[] {
  return entries.filter((e) => e.date === date)
}

export function sumEntries(entries: CalendarEntry[]): number {
  return entries.reduce((s, e) => s + e.amount, 0)
}

export interface MonthTotals {
  paid: number
  due: number
  /** Unconfirmed, kept out of `due`. */
  potential: number
}

/** What a calendar month adds up to, keeping settled and outstanding apart. */
export function monthTotals(entries: CalendarEntry[], month: string): MonthTotals {
  const inMonth = entries.filter((e) => e.date.startsWith(month))
  return {
    paid: sumEntries(inMonth.filter((e) => e.kind === 'paid')),
    due: sumEntries(inMonth.filter((e) => e.kind === 'due' && !e.isPotential)),
    potential: sumEntries(inMonth.filter((e) => e.kind === 'due' && e.isPotential)),
  }
}

/** The earliest month with anything on it, so the grid knows how far back to allow. */
export function earliestMonth(entries: CalendarEntry[]): string | null {
  const dates = entries.map((e) => e.date).sort()
  return dates.length ? dates[0].slice(0, 7) : null
}
