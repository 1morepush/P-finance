import type { Shift } from '../types'

/**
 * Spreading a tank of fuel across the shifts that burned it.
 *
 * A fill-up is one transaction, but the fuel it buys is spent over days.
 * Charging it to whichever shift happened to stop at the pump makes that shift
 * look like a disaster and every shift after it look free:
 *
 *   Mon  $23.80 earned, $53.54 fuel  →  −$29.74
 *   Tue  $35.80 earned, $0.00 fuel   →  +$35.80
 *
 * Both ran on the same tank. Neither figure means anything on its own.
 *
 * What actually left the bank is still the fill-up, on the day it happened —
 * that is cash and it is not re-written here. What this produces is the other
 * question: what did an evening of driving cost to run.
 */

/** How a tank's cost was divided. */
export type ShareBasis =
  /** By miles driven — the only basis that tracks what fuel is actually spent on. */
  | 'miles'
  /** By hours online, when miles were not logged. A rough stand-in for distance. */
  | 'hours'
  /** Evenly, when neither was logged. Assumes every shift drove the same. */
  | 'even'
  /** Ran on fuel bought before the log starts, so there is nothing to divide. */
  | 'untracked'

export interface FuelShare {
  shiftId: string
  /** Fuel bought on this shift. What left the bank, unchanged. */
  spent: number
  /** This shift's share of the fuel bought for the stretch it belongs to. */
  share: number
  basis: ShareBasis
  /** Earnings less the share — what the driving was worth, not what the pump took. */
  profit: number
  /** True while more shifts may still join this stretch, so the share can fall. */
  provisional: boolean
}

/** Oldest first, with a stable tiebreak so equal dates do not reshuffle. */
function inOrder(shifts: Shift[]): Shift[] {
  return [...shifts].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

/**
 * Which basis a stretch can use. Miles and hours are only honest when every
 * shift in the stretch has them: mixing a shift with 40 miles logged against
 * one with none would hand the whole tank to the first.
 */
function basisFor(stretch: Shift[]): ShareBasis {
  if (stretch.every((s) => (s.miles ?? 0) > 0)) return 'miles'
  if (stretch.every((s) => (s.hours ?? 0) > 0)) return 'hours'
  return 'even'
}

function weightOf(shift: Shift, basis: ShareBasis): number {
  if (basis === 'miles') return shift.miles ?? 0
  if (basis === 'hours') return shift.hours ?? 0
  return 1
}

/**
 * Divides each fill-up across the shifts it fuelled.
 *
 * A stretch begins at every shift that bought fuel and runs until the next one
 * does. Shifts before the first fill-up were driving on fuel bought before the
 * log began, so they get no share rather than a guessed one.
 *
 * Each stretch's shares sum to exactly what was spent on it, so the totals
 * still tie to the bank. Rounding lands on the last shift rather than being
 * spread, which keeps the sum exact instead of nearly right.
 */
export function fuelShares(shifts: Shift[]): Map<string, FuelShare> {
  const ordered = inOrder(shifts)
  const out = new Map<string, FuelShare>()

  // Where each stretch starts: every shift that put fuel in the tank.
  const starts = ordered.flatMap((s, i) => (s.gasCost > 0 ? [i] : []))

  // Everything before the first fill-up ran on fuel this log never saw.
  const firstStart = starts[0] ?? ordered.length
  for (const shift of ordered.slice(0, firstStart)) {
    out.set(shift.id, {
      shiftId: shift.id,
      spent: shift.gasCost,
      share: 0,
      basis: 'untracked',
      profit: shift.earnings,
      provisional: false,
    })
  }

  starts.forEach((start, n) => {
    const end = starts[n + 1] ?? ordered.length
    const stretch = ordered.slice(start, end)
    const pot = stretch.reduce((sum, s) => sum + s.gasCost, 0)
    const basis = basisFor(stretch)
    const totalWeight = stretch.reduce((sum, s) => sum + weightOf(s, basis), 0)
    // The last stretch has no fill-up closing it, so more shifts may still land
    // in it and every share in it may still fall.
    const provisional = n === starts.length - 1

    let allocated = 0
    stretch.forEach((shift, i) => {
      const last = i === stretch.length - 1
      const share = last
        ? Math.round((pot - allocated) * 100) / 100
        : Math.round((pot * (weightOf(shift, basis) / (totalWeight || 1))) * 100) / 100
      allocated = Math.round((allocated + share) * 100) / 100
      out.set(shift.id, {
        shiftId: shift.id,
        spent: shift.gasCost,
        share,
        basis,
        profit: Math.round((shift.earnings - share) * 100) / 100,
        provisional,
      })
    })
  })

  return out
}

export interface FuelShareSummary {
  /** Shifts whose fuel came from a stretch this log can see. */
  covered: number
  /** Shifts running on fuel bought before the log began. */
  untracked: number
  /** What was actually spent on fuel across these shifts. */
  spent: number
  /** What was handed out. Equals `spent` less anything in an untracked stretch. */
  shared: number
  /** The basis used, or 'mixed' when stretches differ. */
  basis: ShareBasis | 'mixed'
  /** Fuel per mile, where miles were logged — the figure worth watching. */
  perMile: number | null
}

export function summariseShares(shifts: Shift[]): FuelShareSummary {
  const shares = fuelShares(shifts)
  const rows = shifts.map((s) => shares.get(s.id)).filter((r): r is FuelShare => !!r)
  const bases = new Set(rows.filter((r) => r.basis !== 'untracked').map((r) => r.basis))
  const miles = shifts.reduce((sum, s) => sum + (s.miles ?? 0), 0)
  const shared = rows.reduce((sum, r) => sum + r.share, 0)

  return {
    covered: rows.filter((r) => r.basis !== 'untracked').length,
    untracked: rows.filter((r) => r.basis === 'untracked').length,
    spent: Math.round(shifts.reduce((sum, s) => sum + s.gasCost, 0) * 100) / 100,
    shared: Math.round(shared * 100) / 100,
    basis: bases.size === 1 ? [...bases][0] : bases.size === 0 ? 'untracked' : 'mixed',
    // Measured, not assumed: what the driving actually cost per mile, rather
    // than a pump price divided by a number off a window sticker.
    perMile: miles > 0 ? Math.round((shared / miles) * 1000) / 1000 : null,
  }
}
