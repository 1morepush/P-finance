import type { PaycheckInputs, PayFrequency } from '../types'

/**
 * What an hourly paycheck comes to after tax — FedEx, or any W-2 hourly job in
 * North Carolina.
 *
 * An estimate, and built to be honest about it: it assumes a W-4 with nothing
 * checked, single filing, and the same hours every week. For that W-4 the
 * federal line is the IRS's own payroll formula, not an approximation of it —
 * Pub 15-T's percentage method subtracts $8,600 and then withholds nothing on
 * the first $7,500, which is the $16,100 standard deduction, and its bands
 * above that are the tax brackets shifted by the same amount.
 *
 * Figures are for tax year 2026:
 *   federal brackets and standard deduction — IRS, Rev. Proc. 2025-32
 *   Social Security wage base $184,500 — SSA
 *   NC flat 3.99% "for taxable years after 2025", standard deduction $12,750 — NCDOR
 */

export const CHECKS_PER_YEAR: Record<PayFrequency, number> = { weekly: 52, biweekly: 26, monthly: 12 }

/** 2026, single. Each band is [upper bound of taxable income, rate]. */
const FEDERAL_SINGLE_2026: [number, number][] = [
  [12_400, 0.1],
  [50_400, 0.12],
  [105_700, 0.22],
  [201_775, 0.24],
  [256_225, 0.32],
  [640_600, 0.35],
  [Infinity, 0.37],
]
export const FEDERAL_STANDARD_DEDUCTION = 16_100

export const SOCIAL_SECURITY_RATE = 0.062
export const SOCIAL_SECURITY_WAGE_BASE = 184_500
export const MEDICARE_RATE = 0.0145
/** Additional Medicare on wages over $200,000. Out of reach here, kept for correctness. */
const ADDITIONAL_MEDICARE_RATE = 0.009
const ADDITIONAL_MEDICARE_THRESHOLD = 200_000

export const NC_RATE = 0.0399
export const NC_STANDARD_DEDUCTION = 12_750

/** Most "no tax on overtime" can deduct in a year, filing single. */
export const OVERTIME_DEDUCTION_CAP = 12_500

/** Tax on a year's taxable income, run through the brackets. */
export function federalTax(taxable: number): number {
  let tax = 0
  let floor = 0
  for (const [ceiling, rate] of FEDERAL_SINGLE_2026) {
    if (taxable <= floor) break
    tax += (Math.min(taxable, ceiling) - floor) * rate
    floor = ceiling
  }
  return tax
}

export function marginalRate(taxable: number): number {
  for (const [ceiling, rate] of FEDERAL_SINGLE_2026) if (taxable <= ceiling) return rate
  return 0.37
}

const cents = (n: number) => Math.round(n * 100) / 100

export interface PaycheckEstimate {
  /** Before anything comes out. */
  gross: number
  regularPay: number
  overtimePay: number
  regularHours: number
  overtimeHours: number
  preTax: number
  federal: number
  socialSecurity: number
  medicare: number
  state: number
  afterTax: number
  /** What lands in the bank. */
  net: number
  /** All of the above for a year, from the unrounded figures. */
  yearGross: number
  yearNet: number
  /** Take-home spread across the hours actually worked. */
  netPerHour: number
  /** Share of gross that did not reach the bank. */
  takenOut: number
  /**
   * The overtime premium — the "half" in time and a half — is deductible under
   * the 2025 law, up to $12,500 a year. Payroll still withholds on it, so it
   * comes back as a refund at tax time, not a bigger check.
   */
  overtimeRefund: number
}

const ZERO: PaycheckEstimate = {
  gross: 0, regularPay: 0, overtimePay: 0, regularHours: 0, overtimeHours: 0, preTax: 0, federal: 0,
  socialSecurity: 0, medicare: 0, state: 0, afterTax: 0, net: 0, yearGross: 0,
  yearNet: 0, netPerHour: 0, takenOut: 0, overtimeRefund: 0,
}

export function estimatePaycheck(input: PaycheckInputs): PaycheckEstimate {
  const rate = Math.max(input.hourlyRate || 0, 0)
  const hours = Math.max(input.hoursPerWeek || 0, 0)
  if (rate === 0 || hours === 0) return ZERO

  const checks = CHECKS_PER_YEAR[input.frequency]
  const weeksPerCheck = 52 / checks

  // Overtime is counted week by week, as the law counts it — 45 hours one week
  // and 35 the next is 5 hours of overtime, not an even 80.
  const overtimeHoursWeek = Math.max(hours - 40, 0)
  const regularWeek = Math.min(hours, 40) * rate
  const overtimeWeek = overtimeHoursWeek * rate * 1.5
  const premiumWeek = overtimeHoursWeek * rate * 0.5

  const yearGross = (regularWeek + overtimeWeek) * 52
  const yearPreTax = Math.max(input.preTaxPerCheck || 0, 0) * checks
  const yearAfterTax = Math.max(input.afterTaxPerCheck || 0, 0) * checks

  // Pre-tax premiums come out of every wage base: income tax and payroll tax.
  const wages = Math.max(yearGross - yearPreTax, 0)
  const federalTaxable = Math.max(wages - FEDERAL_STANDARD_DEDUCTION, 0)

  const yearFederal = federalTax(federalTaxable)
  const yearSocialSecurity = Math.min(wages, SOCIAL_SECURITY_WAGE_BASE) * SOCIAL_SECURITY_RATE
  const yearMedicare =
    wages * MEDICARE_RATE + Math.max(wages - ADDITIONAL_MEDICARE_THRESHOLD, 0) * ADDITIONAL_MEDICARE_RATE
  const yearState = Math.max(wages - NC_STANDARD_DEDUCTION, 0) * NC_RATE

  const overtimeDeduction = Math.min(premiumWeek * 52, OVERTIME_DEDUCTION_CAP)
  const overtimeRefund = yearFederal - federalTax(Math.max(federalTaxable - overtimeDeduction, 0))

  // Each line is rounded to the cent and take-home is what is left of them,
  // so the stub adds up exactly rather than nearly.
  const gross = cents(yearGross / checks)
  const regularPay = cents(regularWeek * weeksPerCheck)
  const overtimePay = cents(gross - regularPay)
  const preTax = cents(yearPreTax / checks)
  const federal = cents(yearFederal / checks)
  const socialSecurity = cents(yearSocialSecurity / checks)
  const medicare = cents(yearMedicare / checks)
  const state = cents(yearState / checks)
  const afterTax = cents(yearAfterTax / checks)
  const net = cents(gross - preTax - federal - socialSecurity - medicare - state - afterTax)

  return {
    gross,
    regularPay,
    overtimePay,
    regularHours: cents(Math.min(hours, 40) * weeksPerCheck),
    overtimeHours: cents(overtimeHoursWeek * weeksPerCheck),
    preTax,
    federal,
    socialSecurity,
    medicare,
    state,
    afterTax,
    net,
    yearGross: cents(yearGross),
    yearNet: cents(net * checks),
    netPerHour: cents(net / (hours * weeksPerCheck)),
    takenOut: gross > 0 ? (gross - net) / gross : 0,
    overtimeRefund: cents(overtimeRefund),
  }
}

export const DEFAULT_PAYCHECK: PaycheckInputs = {
  hourlyRate: 0,
  hoursPerWeek: 0,
  // FedEx pays hourly staff weekly.
  frequency: 'weekly',
  preTaxPerCheck: 0,
  afterTaxPerCheck: 0,
}
