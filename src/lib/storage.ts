import { useEffect, useState } from 'react'
import type { AppState } from '../types'
import { seedState } from '../data/seed'

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
    const parsed = JSON.parse(raw) as Partial<AppState>
    return { ...seedState, ...parsed }
  } catch {
    return seedState
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  return [state, setState] as const
}

export function exportStateAsJson(state: AppState): string {
  return JSON.stringify(state, null, 2)
}

export function parseImportedState(raw: string): AppState {
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.debts)) {
    throw new Error('That file does not look like a P-Finance export.')
  }
  return { ...seedState, ...parsed } as AppState
}

/** Discards saved data and returns to the seeded source-of-truth figures. */
export function resetToSeed(): AppState {
  localStorage.removeItem(STORAGE_KEY)
  LEGACY_KEYS.forEach((k) => localStorage.removeItem(k))
  return seedState
}
