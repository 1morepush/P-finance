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
  /** Null when no shift in the period recorded hours. */
  netPerHour: number | null
  netPerMile: number | null
  /** Share of gross swallowed by fuel. */
  gasShare: number
  /**
   * Miles × the IRS standard rate. Usually larger than fuel alone, since it also
   * covers wear, so it — not gas — is what reduces the tax bill.
   */
  mileageDeduction: number
}

/**
 * IRS standard mileage rate for business use, 2026. Used only to show the
 * deduction a logged mileage figure is worth; it does not affect net profit.
 */
export const MILEAGE_RATE = 0.7

export function summarize(shifts: Shift[]): GigSummary {
  const gross = shifts.reduce((s, x) => s + x.earnings, 0)
  const gas = shifts.reduce((s, x) => s + x.gasCost, 0)
  const hours = shifts.reduce((s, x) => s + (x.hours ?? 0), 0)
  const miles = shifts.reduce((s, x) => s + (x.miles ?? 0), 0)
  const net = gross - gas
  return {
    count: shifts.length,
    gross,
    gas,
    net,
    hours,
    miles,
    netPerHour: hours > 0 ? net / hours : null,
    netPerMile: miles > 0 ? net / miles : null,
    gasShare: gross > 0 ? gas / gross : 0,
    mileageDeduction: miles * MILEAGE_RATE,
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
