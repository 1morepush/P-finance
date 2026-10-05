import type { AppState, Shift } from '../types'
import { addDays, today } from './schedule'
import { uid } from './id'

/** What a shift actually put in your pocket. */
export function shiftNet(shift: Shift): number {
  return shift.earnings - shift.gasCost
}

/** Net per hour, or null when hours were not recorded. */
export function shiftPerHour(shift: Shift): number | null {
  return shift.hours && shift.hours > 0 ? shiftNet(shift) / shift.hours : null
}

export interface GigSummary {
  count: number
  gross: number
  gas: number
  net: number
  hours: number
  miles: number
  /** The part of `miles` worked out from the range display rather than read off a meter. */
  milesEstimated: number
  /** Miles from 1099 work — the only miles the deduction counts. */
  businessMiles: number
  /** Miles driven for W-2 work, which an employee cannot deduct. */
  w2Miles: number
  /** Null when no shift in the period recorded hours. */
  netPerHour: number | null
  netPerMile: number | null
  /** Share of gross swallowed by fuel. */
  gasShare: number
  /**
   * Business miles × the IRS standard rate in force on each shift's date.
   * Usually larger than fuel alone, since it also covers wear, so it — not
   * gas — is what reduces the tax bill.
   */
  mileageDeduction: number
}

/**
 * IRS standard mileage rates for business use, each from the day it took
 * effect. 2026 has two: 72.5¢ (IR-2025-128) and, from July 1, 76¢
 * (IR-2026-29), raised mid-year for fuel prices. Used only to show what the
 * logged miles are worth at tax time; they do not affect net profit.
 */
export const MILEAGE_RATES: readonly { from: string; rate: number }[] = [
  { from: '2024-01-01', rate: 0.67 },
  { from: '2025-01-01', rate: 0.7 },
  { from: '2026-01-01', rate: 0.725 },
  { from: '2026-07-01', rate: 0.76 },
]

/** The rate for driving done on a given day. Before the table, its first; after it, the latest. */
export function mileageRate(date: string): number {
  let rate = MILEAGE_RATES[0].rate
  for (const r of MILEAGE_RATES) if (date >= r.from) rate = r.rate
  return rate
}

/** Today's rate, for "a mile is worth…" lines that are not about any one shift. */
export function currentRate(): number {
  return mileageRate(today())
}

/** As a reader would say it: 72.5¢, 76¢. */
export function formatRate(rate: number): string {
  return `${Number((rate * 100).toFixed(1))}¢`
}

/** Whether a shift's miles count toward the deduction: 1099 work only. */
export function isDeductible(shift: Pick<Shift, 'paidAs'>): boolean {
  return shift.paidAs !== 'W-2'
}

/** What one shift's miles take off taxable profit. */
export function shiftDeduction(shift: Shift): number {
  return isDeductible(shift) ? (shift.miles ?? 0) * mileageRate(shift.date) : 0
}

export function summarize(shifts: Shift[]): GigSummary {
  const gross = shifts.reduce((s, x) => s + x.earnings, 0)
  const gas = shifts.reduce((s, x) => s + x.gasCost, 0)
  const hours = shifts.reduce((s, x) => s + (x.hours ?? 0), 0)
  const miles = shifts.reduce((s, x) => s + (x.miles ?? 0), 0)
  const milesEstimated = shifts.reduce((s, x) => s + (x.milesFrom === 'range' ? (x.miles ?? 0) : 0), 0)
  const net = gross - gas
  const w2Miles = shifts.reduce((s, x) => s + (isDeductible(x) ? 0 : (x.miles ?? 0)), 0)
  return {
    count: shifts.length,
    gross,
    gas,
    net,
    hours,
    miles,
    milesEstimated,
    businessMiles: miles - w2Miles,
    w2Miles,
    netPerHour: hours > 0 ? net / hours : null,
    netPerMile: miles > 0 ? net / miles : null,
    gasShare: gross > 0 ? gas / gross : 0,
    mileageDeduction: shifts.reduce((s, x) => s + shiftDeduction(x), 0),
  }
}

export function shiftsSince(shifts: Shift[], fromISO: string): Shift[] {
  return shifts.filter((s) => s.date >= fromISO)
}

export function shiftsInMonth(shifts: Shift[], month: string): Shift[] {
  return shifts.filter((s) => s.date.startsWith(month))
}

export type ShiftInput = Omit<Shift, 'id'>

/**
 * Records a shift. When the net is banked it also lands as an income entry, so
 * the weekly split and everything downstream see it like any other earnings.
 */
export function addShift(state: AppState, input: ShiftInput): AppState {
  const shift: Shift = { ...input, id: uid() }
  const net = shiftNet(shift)
  if (!shift.addedToBank) return { ...state, shifts: [...state.shifts, shift] }

  // The entry id is held on the shift so deleting the shift can retract exactly
  // this entry — reversing the balance alone would leave the income double-counted.
  const incomeEntryId = uid()
  return {
    ...state,
    shifts: [...state.shifts, { ...shift, incomeEntryId }],
    bankBalance: { amount: state.bankBalance.amount + net, updatedAt: shift.date },
    incomeEntries: [
      ...state.incomeEntries,
      {
        id: incomeEntryId,
        date: shift.date,
        amount: net,
        note: `${shift.platform} — net of ${shift.gasCost.toFixed(2)} gas`,
      },
    ],
  }
}

/** Removes a shift, undoing the bank credit and income entry it created. */
export function removeShift(state: AppState, shiftId: string): AppState {
  const shift = state.shifts.find((s) => s.id === shiftId)
  if (!shift) return state
  const net = shiftNet(shift)
  return {
    ...state,
    shifts: state.shifts.filter((s) => s.id !== shiftId),
    bankBalance: shift.addedToBank
      ? { ...state.bankBalance, amount: state.bankBalance.amount - net }
      : state.bankBalance,
    incomeEntries: shift.incomeEntryId
      ? state.incomeEntries.filter((e) => e.id !== shift.incomeEntryId)
      : state.incomeEntries,
  }
}

/**
 * Replaces a shift's figures. Routed through remove-then-add so the bank
 * balance and income entry are unwound and reapplied by the same tested code
 * rather than patched in place.
 */
export function updateShift(state: AppState, shiftId: string, input: ShiftInput): AppState {
  if (!state.shifts.some((s) => s.id === shiftId)) return state
  return addShift(removeShift(state, shiftId), input)
}

/** Recent shifts, newest first. */
export function recentShifts(shifts: Shift[], limit = 10): Shift[] {
  return [...shifts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
}

export function last7Days(shifts: Shift[], now = today()): Shift[] {
  return shiftsSince(shifts, addDays(now, -6))
}

/** Shifts dated within an inclusive window — a Sunday-to-Saturday week, say. */
export function shiftsBetween(shifts: Shift[], fromISO: string, toISO: string): Shift[] {
  return shifts.filter((s) => s.date >= fromISO && s.date <= toISO)
}

/** Everything worked this calendar year, for the figures a tax return wants. */
export function shiftsThisYear(shifts: Shift[], now = today()): Shift[] {
  return shifts.filter((s) => s.date.startsWith(now.slice(0, 4)))
}

/**
 * Net per shift, for turning "you still need $X" into "about N more shifts".
 * Null until there is at least one shift to average.
 */
export function averageNetPerShift(shifts: Shift[]): number | null {
  if (shifts.length === 0) return null
  return shifts.reduce((s, x) => s + shiftNet(x), 0) / shifts.length
}
