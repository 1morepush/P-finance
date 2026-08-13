export type DebtCategory = 'installment' | 'revolving' | 'personal'
export type DebtStatus = 'active' | 'paid'

export interface Debt {
  id: string
  name: string
  category: DebtCategory
  status: DebtStatus
  /** Current remaining balance in dollars. */
  balance: number
  /** Annual percentage rate, e.g. 22.49 for 22.49%. Omit if unknown/0. */
  apr?: number
  /** Estimated recurring monthly payment in dollars. */
  monthlyPayment?: number
  /** ISO date string for expected/target payoff. */
  payoffDate?: string
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

export type DebtStrategy = 'avalanche' | 'snowball'

export interface Settings {
  strategy: DebtStrategy
  /** Percent (0-100) of leftover cash (after weekly minimum debt obligations) routed to savings. */
  savingsPercent: number
}

export interface BankBalance {
  amount: number
  updatedAt: string
}

export interface AppState {
  bankBalance: BankBalance
  savingsBalance: number
  debts: Debt[]
  incomeSources: IncomeSource[]
  incomeEntries: IncomeEntry[]
  pendingClaims: PendingClaim[]
  settings: Settings
}
