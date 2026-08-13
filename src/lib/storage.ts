import { useEffect, useState } from 'react'
import type { AppState } from '../types'
import { seedState } from '../data/seed'

const STORAGE_KEY = 'p-finance/state/v1'

function loadState(): AppState {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return seedState
  try {
    return { ...seedState, ...JSON.parse(raw) } as AppState
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
  return parsed as AppState
}
