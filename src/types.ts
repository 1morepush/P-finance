/** The lender/product a debt sits with. Drives grouping and display. */
export type DebtProduct =
  | 'personal'
  | 'paypal_pay_monthly'
  | 'paypal_pay_in_4'
  | 'affirm_pay_monthly'
  | 'affirm_pay_in_4'
  | 'klarna_pay_in_4'
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
  notes?: string
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
  bankBalance: BankBalance
  savingsBalance: number
  debts: Debt[]
  clearedDebts: ClearedDebt[]
  incomeSources: IncomeSource[]
  incomeEntries: IncomeEntry[]
  pendingClaims: PendingClaim[]
  settings: Settings
}

const PRODUCT_CATEGORY: Record<DebtProduct, DebtCategory> = {
  personal: 'personal',
  credit_card: 'revolving',
  paypal_pay_monthly: 'installment',
  paypal_pay_in_4: 'installment',
  affirm_pay_monthly: 'installment',
  affirm_pay_in_4: 'installment',
  klarna_pay_in_4: 'installment',
}

export function categoryOf(debt: Debt): DebtCategory {
  return PRODUCT_CATEGORY[debt.product]
}

export const PRODUCT_LABEL: Record<DebtProduct, string> = {
  personal: 'Personal',
  credit_card: 'Credit card',
  paypal_pay_monthly: 'PayPal Pay Monthly',
  paypal_pay_in_4: 'PayPal Pay in 4',
  affirm_pay_monthly: 'Affirm Pay Monthly',
  affirm_pay_in_4: 'Affirm Pay in 4',
  klarna_pay_in_4: 'Klarna Pay in 4',
}

export const TIER_LABEL: Record<PriorityTier, string> = {
  0: 'Urgent',
  1: 'High interest (~36%)',
  2: '0% promo BNPL',
  3: 'Apple Card (22.49%)',
  4: 'Personal / flexible',
}
