import { useEffect, useState } from 'react'
import type { AppState } from '../types'
import { SEED_DATE, SEED_VERSION, seedState } from '../data/seed'
import { replayManualPayments } from './payments'
import { today } from './schedule'

// v2 introduced products, priority tiers, `potential` status and the cleared-debt
// log. The key is versioned so a v1 payload is never read as a v2 shape — a stale
// v1 debt has no product/tier and would break ordering and the category colours.
const STORAGE_KEY = 'p-finance/state/v2'
const LEGACY_KEYS = ['p-finance/state/v1']

/**
 * Every localStorage call is guarded.
 *
 * Reaching `localStorage` is not merely unreliable — on iOS with "Block All
 * Cookies", and in some private modes, the property access itself throws. An
 * unguarded read here happens during the very first render, so it would not
 * lose data, it would white-screen the app before anything drew.
 */
function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeRaw(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    // Quota exhausted, or storage blocked. Nothing useful to do here, and
    // throwing out of an effect would take the whole app down.
    return false
  }
}

function loadState(): AppState {
  const raw = readRaw(STORAGE_KEY)
  if (!raw) {
    // Drop any v1 payload so it can't be picked up later, and start from the
    // current source-of-truth seed.
    try {
      LEGACY_KEYS.forEach((k) => localStorage.removeItem(k))
    } catch {
      // Nothing to clean up if storage is unreachable.
    }
    return seedState
  }
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return seedState
    return merge(parsed as Partial<AppState>)
  } catch {
    return seedState
  }
}

/** Collections that must be arrays for the app to run at all. */
const COLLECTIONS = [
  'debts',
  'clearedDebts',
  'payments',
  'incomeSources',
  'incomeEntries',
  'expenses',
  'shifts',
  'pendingClaims',
  'snapshots',
] as const

/**
 * Drops any collection that is not an array so the seed's own is used instead.
 * A hand-edited or truncated import with `payments: null` would otherwise
 * crash on the first `.filter` rather than being rejected.
 */
function sound(parsed: Partial<AppState>): Partial<AppState> {
  const out: Partial<AppState> = { ...parsed }
  for (const key of COLLECTIONS) {
    if (!Array.isArray(out[key])) delete out[key]
  }
  if (!out.bankBalance || typeof out.bankBalance.amount !== 'number') delete out.bankBalance
  if (typeof out.savingsBalance !== 'number') delete out.savingsBalance
  // A vehicle missing its figures would divide by undefined and print NaN
  // across the fuel card; the seed's own is better than that.
  const v = out.vehicle
  if (
    !v ||
    typeof v.cityMpg !== 'number' ||
    typeof v.highwayMpg !== 'number' ||
    typeof v.tankGallons !== 'number' ||
    v.cityMpg <= 0 ||
    v.highwayMpg <= 0 ||
    v.tankGallons <= 0
  ) {
    delete out.vehicle
  }
  return out
}

/**
 * Layers a saved payload over the seed. `settings` is merged key-by-key rather
 * than replaced, so a payload written before a setting existed picks up its
 * default instead of leaving it undefined.
 */
function merge(raw: Partial<AppState>): AppState {
  const parsed = sound(raw)
  return {
    ...seedState,
    ...parsed,
    // Must come from the saved payload alone. Spreading the seed over data that
    // predates stamping would hand it the current version and the device would
    // never be told its figures are stale — the very failure this guards against.
    seedVersion: parsed.seedVersion,
    // Same reasoning as seedVersion: taking this from the seed would tell a
    // device that has never exported that it is safely backed up.
    lastBackupAt: parsed.lastBackupAt,
    settings: { ...seedState.settings, ...parsed.settings },
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(loadState)

  const [persisted, setPersisted] = useState(true)

  useEffect(() => {
    setPersisted(writeRaw(STORAGE_KEY, JSON.stringify(state)))
  }, [state])

  // `persisted` is false when the browser refused the write — worth surfacing,
  // since the user would otherwise assume their entries are being kept.
  return [state, setState, persisted] as const
}

/** Collections that come from the reconciled source table rather than from use. */
const SEEDED_KEYS = ['debts', 'clearedDebts', 'pendingClaims', 'incomeSources'] as const

/** True when the app ships figures newer than the ones this device is holding. */
export function seedUpdateAvailable(state: AppState): boolean {
  return state.seedVersion !== SEED_VERSION && state.skippedSeedVersion !== SEED_VERSION
}

/**
 * Takes the newer figures, replacing only the seeded collections. Everything
 * earned through use — bank balance, savings, logged payments, income entries
 * and settings — is left untouched.
 *
 * Payments logged by hand since the figures' own date are then re-applied to
 * the fresh balances. The table reflects what the lender knew on that date; a
 * $500 sent to the card the day after is not in it, and simply keeping the
 * record while the balance snapped back to the old figure meant the money had
 * gone out of the bank and not come off the debt.
 */
export function applySeedUpdate(state: AppState): AppState {
  const next = { ...state, seedVersion: SEED_VERSION, skippedSeedVersion: undefined }
  for (const key of SEEDED_KEYS) {
    Object.assign(next, { [key]: seedState[key] })
  }
  return replayManualPayments(next, SEED_DATE)
}

/** Keeps this device's own figures, and stops offering this particular update. */
export function skipSeedUpdate(state: AppState): AppState {
  return { ...state, skippedSeedVersion: SEED_VERSION }
}

export function exportStateAsJson(state: AppState): string {
  return JSON.stringify(state, null, 2)
}

/** Records that a backup was taken, so the app can say how stale the last one is. */
export function markBackedUp(state: AppState, when = today()): AppState {
  return { ...state, lastBackupAt: when }
}

/**
 * What an import would replace, so the confirmation can say what is at stake.
 * Throws the same way `parseImportedState` does on a file that is not ours.
 */
export function describeImport(raw: string): {
  state: AppState
  debts: number
  payments: number
  shifts: number
  seedVersion: string | null
} {
  const state = parseImportedState(raw)
  return {
    state,
    debts: state.debts.length,
    payments: state.payments.length,
    shifts: state.shifts.length,
    seedVersion: state.seedVersion ?? null,
  }
}

export function parseImportedState(raw: string): AppState {
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.debts)) {
    throw new Error('That file does not look like a P-Finance export.')
  }
  return merge(parsed as Partial<AppState>)
}

/**
 * The saved payload exactly as the browser holds it, for getting data out of a
 * device the app can no longer render on. Null when there is nothing stored or
 * storage cannot be reached.
 */
export function rawSavedState(): string | null {
  return readRaw(STORAGE_KEY)
}

/** Discards saved data and returns to the seeded source-of-truth figures. */
export function resetToSeed(): AppState {
  try {
    localStorage.removeItem(STORAGE_KEY)
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k))
  } catch {
    // The in-memory reset below still applies.
  }
  return seedState
}
