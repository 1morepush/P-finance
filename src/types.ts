/** The lender/product a debt sits with. Drives grouping and display. */
export type DebtProduct =
  | 'personal'
  | 'paypal_pay_monthly'
  | 'paypal_pay_in_4'
  | 'affirm_pay_monthly'
  | 'affirm_pay_in_4'
  | 'klarna_pay_in_4'
  | 'event_installment'
  | 'credit_card'

/** Coarse grouping used for the dashboard breakdown and colour coding. */
export type DebtCategory = 'installment' | 'revolving' | 'personal'

/**
 * Payoff priority.
 * 0 urgent · 1 highest interest (~36% APR) · 2 0% promo BNPL
 * 3 Apple Card (22.49%) · 4 personal / flexible
 */
export type PriorityTier = 0 | 1 | 2 | 3 | 4

/** `potential` = not yet confirmed; excluded from active-debt totals. */
export type DebtStatus = 'active' | 'potential' | 'paid'

export interface Debt {
  id: string
  name: string
  product: DebtProduct
  status: DebtStatus
  priorityTier: PriorityTier
  /** Current remaining balance in dollars. */
  balance: number
  /** Annual percentage rate, e.g. 22.49. 0 means confirmed or presumed 0% promotional financing. */
  apr: number
  /** Recurring monthly payment in dollars. Absent for personal debts with no schedule. */
  monthlyPayment?: number
  /** ISO date (YYYY-MM-DD), or a token like `ASAP` / `flexible` for informal debts. */
  nextDue?: string
  /** ISO date of the final scheduled payment. Absent for revolving/personal debt. */
  finalPaymentDate?: string
  /**
   * When a due date passes, assume the payment went through (autopay) and settle
   * it automatically. Set false for anything paid by hand, or that might be missed.
   * Defaults to true when absent.
   */
  autoMarkPaid?: boolean
  /** Due dates moved by agreement with the lender, most recent last. */
  deferrals?: Deferral[]
  notes?: string
}

/**
 * A due date pushed back by arrangement — a hardship call, a payment holiday.
 * Kept as a record rather than folded into the date, so what was agreed, with
 * whom and when survives the date being moved again.
 */
export interface Deferral {
  /** ISO date the arrangement was made. */
  date: string
  /** The due date it moved from. */
  from: string
  /** The due date it moved to. */
  to: string
  note?: string
}

/** Historical record of a debt that has been fully paid off. */
export interface ClearedDebt {
  id: string
  name: string
  product: DebtProduct | 'paypal' | 'klarna' | 'affirm'
  /** The balance that was outstanding when this debt was cleared. */
  amountCleared: number
  /** ISO date the debt was cleared. */
  dateCleared: string
  /**
   * Written off by the lender rather than paid. Still cleared, still off the
   * total — but not money that left the account, so it must not count toward
   * the rate at which debt is being paid down.
   */
  forgiven?: boolean
  notes?: string
}

/**
 * The active total as it stood on a given day, recorded once a day. The
 * progress chart used to reconstruct this backwards from the payment log,
 * which is exactly the figure a duplicated or edited record corrupts; a
 * snapshot is what was actually on screen.
 */
export interface Snapshot {
  date: string
  total: number
}

/** A payment logged against a specific debt. Carries enough to be undone exactly. */
export interface Payment {
  id: string
  debtId: string
  /** Snapshot of the name, so history survives the debt being renamed or removed. */
  debtName: string
  amount: number
  /** ISO date the payment was made. */
  date: string
  /** Whether it was deducted from the bank balance. */
  fromBank: boolean
  /** This payment zeroed the debt and moved it into the cleared log. */
  clearedDebt: boolean
  /** The due date before it was advanced, if it was. */
  previousNextDue?: string
  /** Settled automatically because its due date passed, rather than entered by hand. */
  auto?: boolean
}

/** One gig-work shift: what came in, what the driving cost, and what is left. */
export interface Shift {
  id: string
  /** ISO date the shift was worked. */
  date: string
  /** DoorDash, Uber Eats, and so on. */
  platform: string
  /** Gross payout including tips. */
  earnings: number
  /** Fuel bought for this shift. */
  gasCost: number
  /** Miles driven, if tracked — needed for the mileage deduction at tax time. */
  miles?: number
  /** Hours online, if tracked — needed for net per hour. */
  hours?: number
  /** The net was added to the bank balance, so deleting it must take it back out. */
  addedToBank: boolean
  /** The income entry the banked net created, so deleting the shift removes that too. */
  incomeEntryId?: string
  notes?: string
}

export type IncomeFrequency = 'weekly' | 'biweekly' | 'monthly' | 'variable' | 'one-time'

export interface IncomeSource {
  id: string
  name: string
  /** Typical amount per occurrence, in dollars. Use 0 if unknown/variable. */
  amount: number
  frequency: IncomeFrequency
  active: boolean
  /**
   * ISO date of the last payment expected from this source, when it has a known
   * end — benefits that run out, a contract that finishes. Without it the app
   * projects the income forward forever, which is how a cliff gets missed.
   */
  endsOn?: string
  notes?: string
}

export type ExpenseCadence = 'weekly' | 'biweekly' | 'monthly'

/** A recurring cost. Without these the leftover in the split is fiction. */
export interface Expense {
  id: string
  name: string
  amount: number
  cadence: ExpenseCadence
  /** True for rent, utilities, insurance — the ones that cannot simply be skipped. */
  essential: boolean
  notes?: string
}

export interface IncomeEntry {
  id: string
  /** ISO date string of when this income was received. */
  date: string
  amount: number
  sourceId?: string
  note?: string
}

export interface PendingClaim {
  id: string
  name: string
  low: number
  high: number
  notes?: string
}

export type DebtStrategy = 'tier' | 'avalanche' | 'snowball'

export interface Settings {
  strategy: DebtStrategy
  /** Percent (0-100) of leftover cash (after weekly minimum debt obligations) routed to savings. */
  savingsPercent: number
  /**
   * Percent (0-100) of that same leftover deliberately left in checking to build a
   * cushion. Together with savingsPercent this must not exceed 100; whatever remains
   * goes to extra debt payoff.
   */
  keepInCheckingPercent: number
}

export interface BankBalance {
  amount: number
  updatedAt: string
}

export interface AppState {
  /**
   * Which vintage of the seed figures this data came from. Absent on data saved
   * before stamping existed, which is treated as out of date.
   */
  seedVersion?: string
  /** A seed version the user chose to skip, so it is not offered again. */
  skippedSeedVersion?: string
  bankBalance: BankBalance
  savingsBalance: number
  debts: Debt[]
  clearedDebts: ClearedDebt[]
  payments: Payment[]
  incomeSources: IncomeSource[]
  incomeEntries: IncomeEntry[]
  expenses: Expense[]
  shifts: Shift[]
  pendingClaims: PendingClaim[]
  /** One per calendar day the app was opened, oldest first. */
  snapshots: Snapshot[]
  settings: Settings
  /** ISO date of the last export. Only this device holds the data, so staleness matters. */
  lastBackupAt?: string
}

const PRODUCT_CATEGORY: Record<DebtProduct, DebtCategory> = {
  personal: 'personal',
  credit_card: 'revolving',
  paypal_pay_monthly: 'installment',
  paypal_pay_in_4: 'installment',
  affirm_pay_monthly: 'installment',
  affirm_pay_in_4: 'installment',
  klarna_pay_in_4: 'installment',
  event_installment: 'installment',
}

export function categoryOf(debt: Debt): DebtCategory {
  return PRODUCT_CATEGORY[debt.product]
}

/** Category for a bare product, where no full debt record is to hand. */
export function categoryOfProduct(product: DebtProduct): DebtCategory {
  return PRODUCT_CATEGORY[product]
}

export const PRODUCT_LABEL: Record<DebtProduct, string> = {
  personal: 'Personal',
  credit_card: 'Credit card',
  paypal_pay_monthly: 'PayPal Pay Monthly',
  paypal_pay_in_4: 'PayPal Pay in 4',
  affirm_pay_monthly: 'Affirm Pay Monthly',
  affirm_pay_in_4: 'Affirm Pay in 4',
  klarna_pay_in_4: 'Klarna Pay in 4',
  event_installment: 'Event plan',
}

/** How often each product bills. Null means no recurring schedule at all. */
export type Cadence = 'monthly' | 'biweekly' | null

/**
 * Lives here rather than in ./lib/schedule so ./lib/finance can weight a
 * monthly total by it without the two modules importing each other.
 */
export const PRODUCT_CADENCE: Record<DebtProduct, Cadence> = {
  paypal_pay_monthly: 'monthly',
  affirm_pay_monthly: 'monthly',
  credit_card: 'monthly',
  paypal_pay_in_4: 'biweekly',
  affirm_pay_in_4: 'biweekly',
  klarna_pay_in_4: 'biweekly',
  // A single remaining instalment, so the cadence never actually steps. Marked
  // monthly rather than null so a passed due date auto-settles like any other plan.
  event_installment: 'monthly',
  personal: null,
}

/** Billing occurrences per month, by cadence. Pay-in-4 bills 26 times a year. */
export const CADENCE_PER_MONTH = { monthly: 1, biweekly: 26 / 12 } as const

export const TIER_LABEL: Record<PriorityTier, string> = {
  0: 'Urgent',
  1: 'High interest (~36%)',
  2: '0% promo BNPL',
  3: 'Apple Card (22.49%)',
  4: 'Personal / flexible',
}
