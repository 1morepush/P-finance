import type { Shift } from '../types'
import { isDeductible, mileageRate } from './gig'

/**
 * The mileage log a tax preparer, or the IRS, asks for.
 *
 * There is no such thing as an "IRS-approved" app: what makes a log hold up
 * is what it records, written down at the time. Publication 463 asks for the
 * date, the miles, where the driving was and the business purpose for each
 * use of the car, and odometer readings are the strongest proof of the miles.
 * Each shift already carries most of that, so the log is built from them
 * rather than kept as a second record that could disagree.
 */
export interface MileageRow {
  date: string
  platform: string
  /** The business purpose, in the plain words the log wants. */
  purpose: string
  area: string
  odometerStart?: number
  odometerEnd?: number
  miles: number
  /** How the miles were measured — the first thing anyone checking will ask. */
  source: 'odometer' | 'trip meter' | 'estimate' | 'not recorded'
  paidAs: '1099' | 'W-2'
  /** The miles the deduction counts: all of them for 1099 work, none for W-2. */
  businessMiles: number
  rate: number
  deduction: number
  earnings: number
  hours?: number
  notes?: string
}

function sourceOf(shift: Shift): MileageRow['source'] {
  if (!shift.miles) return 'not recorded'
  if (shift.milesFrom === 'odometer') return 'odometer'
  if (shift.milesFrom === 'range') return 'estimate'
  return 'trip meter'
}

export function mileageRow(shift: Shift): MileageRow {
  const paidAs = shift.paidAs ?? '1099'
  const miles = shift.miles ?? 0
  const businessMiles = isDeductible(shift) ? miles : 0
  const rate = mileageRate(shift.date)
  return {
    date: shift.date,
    platform: shift.platform,
    purpose:
      paidAs === 'W-2'
        ? `${shift.platform} shift (W-2 employee, not deductible)`
        : `${shift.platform} deliveries (self-employed)`,
    area: shift.area?.trim() ?? '',
    odometerStart: shift.odometerStart,
    odometerEnd: shift.odometerEnd,
    miles,
    source: sourceOf(shift),
    paidAs,
    businessMiles,
    rate,
    deduction: Math.round(businessMiles * rate * 100) / 100,
    earnings: shift.earnings,
    hours: shift.hours,
    notes: shift.notes,
  }
}

/** One calendar year's shifts as log rows, oldest first — the order a log is kept in. */
export function mileageLog(shifts: Shift[], year: string): MileageRow[] {
  return shifts
    .filter((s) => s.date.startsWith(year))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(mileageRow)
}

export interface RatePeriod {
  from: string
  to: string
  rate: number
  miles: number
  deduction: number
}

export interface MileageTotals {
  shifts: number
  miles: number
  businessMiles: number
  w2Miles: number
  /** Business miles worked out from the range display, which the log should not lean on. */
  estimatedMiles: number
  /** Shifts with no miles at all. */
  missingMiles: number
  deduction: number
  /** One line per rate in force during the year, for "1,200 mi × 72.5¢ + …". */
  periods: RatePeriod[]
}

export function mileageTotals(rows: MileageRow[]): MileageTotals {
  const periods: RatePeriod[] = []
  for (const r of rows) {
    if (r.businessMiles <= 0) continue
    let p = periods.find((x) => x.rate === r.rate)
    if (!p) {
      p = { from: r.date, to: r.date, rate: r.rate, miles: 0, deduction: 0 }
      periods.push(p)
    }
    p.miles += r.businessMiles
    p.deduction += r.businessMiles * r.rate
    if (r.date < p.from) p.from = r.date
    if (r.date > p.to) p.to = r.date
  }
  periods.sort((a, b) => a.from.localeCompare(b.from))
  for (const p of periods) p.deduction = Math.round(p.deduction * 100) / 100
  const sum = (f: (r: MileageRow) => number) => rows.reduce((n, r) => n + f(r), 0)
  return {
    shifts: rows.length,
    miles: sum((r) => r.miles),
    businessMiles: sum((r) => r.businessMiles),
    w2Miles: sum((r) => (r.paidAs === 'W-2' ? r.miles : 0)),
    estimatedMiles: sum((r) => (r.source === 'estimate' ? r.businessMiles : 0)),
    missingMiles: rows.filter((r) => r.source === 'not recorded').length,
    deduction: Math.round(periods.reduce((n, p) => n + p.deduction, 0) * 100) / 100,
    periods,
  }
}

export const MILEAGE_CSV_HEADER =
  'date,platform,business_purpose,area,odometer_start,odometer_end,miles,miles_source,paid_as,business_miles,rate_per_mile,deduction,earnings,hours,notes'

function cell(v: string | number | undefined): string {
  if (v === undefined || v === '') return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** The log as a spreadsheet, with the year's total as its last line. */
export function mileageCsv(rows: MileageRow[]): string {
  const lines = rows.map((r) =>
    [
      r.date,
      r.platform,
      r.purpose,
      r.area,
      r.odometerStart,
      r.odometerEnd,
      r.miles || '',
      r.source,
      r.paidAs,
      r.businessMiles || 0,
      r.rate.toFixed(3),
      r.deduction.toFixed(2),
      r.earnings.toFixed(2),
      r.hours,
      r.notes,
    ]
      .map(cell)
      .join(','),
  )
  const t = mileageTotals(rows)
  lines.push(
    ['TOTAL', '', '', '', '', '', t.miles, '', '', t.businessMiles, '', t.deduction.toFixed(2), '', '', '']
      .map(cell)
      .join(','),
  )
  return [MILEAGE_CSV_HEADER, ...lines].join('\n') + '\n'
}
