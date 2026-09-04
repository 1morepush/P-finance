import { useEffect, useState } from 'react'
import type { AppState } from '../types'
import { SEED_VERSION, seedState } from '../data/seed'

// v2 introduced products, priority tiers, `potential` status and the cleared-debt
// log. The key is versioned so a v1 payload is never read as a v2 shape — a stale
// v1 debt has no product/tier and would break ordering and the category colours.
const STORAGE_KEY = 'p-finance/state/v2'
const LEGACY_KEYS = ['p-finance/state/v1']

function loadState(): AppState {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    // Drop any v1 payload so it can't be picked up later, and start from the
    // current source-of-truth seed.
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k))
    return seedState
  }
  try {
    return merge(JSON.parse(raw) as Partial<AppState>)
  } catch {
    return seedState
  }
}

/**
 * Layers a saved payload over the seed. `settings` is merged key-by-key rather
 * than replaced, so a payload written before a setting existed picks up its
 * default instead of leaving it undefined.
 */
function merge(parsed: Partial<AppState>): AppState {
  return {
    ...seedState,
    ...parsed,
    // Must come from the saved payload alone. Spreading the seed over data that
    // predates stamping would hand it the current version and the device would
    // never be told its figures are stale — the very failure this guards against.
    seedVersion: parsed.seedVersion,
    settings: { ...seedState.settings, ...parsed.settings },
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  return [state, setState] as const
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

export function parseImportedState(raw: string): AppState {
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.debts)) {
    throw new Error('That file does not look like a P-Finance export.')
  }
  return merge(parsed as Partial<AppState>)
}

/** Discards saved data and returns to the seeded source-of-truth figures. */
export function resetToSeed(): AppState {
  localStorage.removeItem(STORAGE_KEY)
  LEGACY_KEYS.forEach((k) => localStorage.removeItem(k))
  return seedState
}
