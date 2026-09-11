import { useEffect, useState } from 'react'
import type { AppState } from '../types'
import { SEED_VERSION, seedState } from '../data/seed'

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
 */
export function applySeedUpdate(state: AppState): AppState {
  const next = { ...state, seedVersion: SEED_VERSION, skippedSeedVersion: undefined }
  for (const key of SEEDED_KEYS) {
    Object.assign(next, { [key]: seedState[key] })
  }
  return next
}

/** Keeps this device's own figures, and stops offering this particular update. */
export function skipSeedUpdate(state: AppState): AppState {
  return { ...state, skippedSeedVersion: SEED_VERSION }
}

export function exportStateAsJson(state: AppState): string {
  return JSON.stringify(state, null, 2)
}

/** Records that a backup was taken, so the app can say how stale the last one is. */
export function markBackedUp(state: AppState, when = new Date().toISOString().slice(0, 10)): AppState {
  return { ...state, lastBackupAt: when }
}

export function parseImportedState(raw: string): AppState {
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.debts)) {
    throw new Error('That file does not look like a P-Finance export.')
  }
  return merge(parsed as Partial<AppState>)
}

/** True when this browser will actually keep what the app writes. */
export function storageWorks(): boolean {
  return writeRaw('p-finance/probe', '1')
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
