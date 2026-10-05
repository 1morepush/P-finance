import type { AppState, SinkingFund } from '../types'
import {
  DEFAULT_FUNDS,
  FLOOR_STEPS,
  FLOOR_TARGET,
  LUMP_SUM,
  PHASES,
  type PlanPhase,
  type PlanTask,
} from '../data/recoveryPlan'
import { startOfWeek, today } from './schedule'

/**
 * Working through the recovery plan: what is ticked off, what is open now,
 * the Sunday check-in, the checking floor and the sinking funds.
 */

export function isDone(state: AppState, id: string): boolean {
  return !!state.planDone?.[id]
}

/** Ticks a to-do, or unticks it. Stamped with the day so the plan can show when. */
export function toggleTask(state: AppState, id: string, now = today()): AppState {
  const done = { ...(state.planDone ?? {}) }
  if (done[id]) delete done[id]
  else done[id] = now
  return { ...state, planDone: done }
}

/** The phase whose window holds today; before the plan starts, the first. */
export function currentPhase(now = today()): PlanPhase {
  return PHASES.find((p) => p.from <= now && now <= p.to) ?? (now < PHASES[0].from ? PHASES[0] : PHASES[PHASES.length - 1])
}

export interface OpenTask extends PlanTask {
  phase: PlanPhase
  /** Its phase's window has closed and it is still open. */
  carried: boolean
}

/**
 * Everything not yet done from every phase that has started — the current
 * one and anything carried over from before it — soonest due first, then in
 * the plan's own order.
 */
export function openTasks(state: AppState, now = today()): OpenTask[] {
  const started = PHASES.filter((p) => p.from <= now)
  const phases = started.length ? started : [PHASES[0]]
  const order = new Map<string, number>()
  let i = 0
  for (const p of PHASES) for (const t of p.tasks) order.set(t.id, i++)
  return phases
    .flatMap((p) => p.tasks.map((t) => ({ ...t, phase: p, carried: p.to < now })))
    .filter((t) => !isDone(state, t.id))
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || order.get(a.id)! - order.get(b.id)!)
}

export function phaseProgress(state: AppState, phase: { tasks: PlanTask[] }): { done: number; total: number } {
  return { done: phase.tasks.filter((t) => isDone(state, t.id)).length, total: phase.tasks.length }
}

export const LUMP_SUM_PHASE = { tasks: LUMP_SUM }

// ── the Sunday check-in ──────────────────────────────────────────────────

/** Ticks for this week only: a new Sunday starts the list again. */
export function checkInDone(state: AppState, now = today()): string[] {
  return state.checkIn?.week === startOfWeek(now) ? state.checkIn.done : []
}

export function toggleCheckIn(state: AppState, id: string, now = today()): AppState {
  const week = startOfWeek(now)
  const done = checkInDone(state, now)
  return {
    ...state,
    checkIn: { week, done: done.includes(id) ? done.filter((d) => d !== id) : [...done, id] },
  }
}

// ── the checking floor ───────────────────────────────────────────────────

export interface FloorStatus {
  target: number
  /** The step being built towards now; null once the target is reached. */
  step: number | null
  steps: number[]
  /** How much more it takes to reach that step. */
  toGo: number
  reached: boolean
}

/**
 * The floor is built in steps — $100, then $200, then $300 — rather than as
 * one figure, so there is always a near target. A floor set to something other
 * than the plan's $300 keeps the steps below it and ends at it.
 */
export function floorStatus(state: AppState): FloorStatus {
  const target = state.settings.checkingFloor ?? FLOOR_TARGET
  const steps = [...FLOOR_STEPS.filter((s) => s < target), target]
  const bank = state.bankBalance.amount
  const step = steps.find((s) => bank < s) ?? null
  return {
    target,
    step,
    steps,
    toGo: step === null ? 0 : Math.round((step - bank) * 100) / 100,
    reached: step === null,
  }
}

// ── sinking funds ────────────────────────────────────────────────────────

export function fundsOf(state: AppState): SinkingFund[] {
  return state.funds ?? DEFAULT_FUNDS
}

/**
 * Moves money from checking into a fund — it is kept in another account,
 * away from the autopays — or back out of it when it is spent.
 */
export function moveToFund(state: AppState, fundId: string, amount: number, now = today()): AppState {
  if (!Number.isFinite(amount) || amount === 0) return state
  const funds = fundsOf(state)
  if (!funds.some((f) => f.id === fundId)) return state
  return {
    ...state,
    funds: funds.map((f) => (f.id === fundId ? { ...f, balance: Math.round((f.balance + amount) * 100) / 100 } : f)),
    bankBalance: { amount: Math.round((state.bankBalance.amount - amount) * 100) / 100, updatedAt: now },
  }
}

/** Spent from the fund directly — the bank is not involved. */
export function spendFromFund(state: AppState, fundId: string, amount: number): AppState {
  if (!Number.isFinite(amount) || amount <= 0) return state
  return {
    ...state,
    funds: fundsOf(state).map((f) =>
      f.id === fundId ? { ...f, balance: Math.round((f.balance - amount) * 100) / 100 } : f,
    ),
  }
}
