import { useMemo, useState } from 'react'
import type { AppState } from '../types'
import { Card } from '../components/Card'
import { CommandBar } from '../components/CommandBar'
import { ScreenshotImport } from '../components/ScreenshotImport'
import { RunwayCard } from '../components/RunwayCard'
import { WeekTargetCard } from '../components/WeekTargetCard'
import { DueAlertCard } from '../components/DueAlertCard'
import { StatTile } from '../components/StatTile'
import { formatCurrency, formatDate } from '../lib/finance'
import { owedWithin, today } from '../lib/schedule'
import { calculateWeeklySplit } from '../lib/split'
import { applyPayment } from '../lib/payments'
import { loadBankLink } from '../lib/bankLink'
import { uid } from '../lib/id'

/**
 * Home is for today: what is in the bank, what this week takes, anything that
 * needs doing now, and the places to tell the app what happened. The totals,
 * the plan and the analysis live with the debts.
 */

export function Dashboard({
  state,
  setState,
  onGoToIncome,
  onGoToSettings,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
  onGoToIncome: () => void
  onGoToSettings: () => void
}) {
  const [incomeInput, setIncomeInput] = useState('')
  const [balanceEdit, setBalanceEdit] = useState(false)
  const [balanceInput, setBalanceInput] = useState(String(state.bankBalance.amount))

  const incomeAmount = Number(incomeInput) || 0
  const split = useMemo(() => calculateWeeklySplit(state, incomeAmount), [state, incomeAmount])
  // Guard against emptying the account into one debt when other payments are
  // imminent. Past-due money counts: it is owed now, not never.
  const owed14 = useMemo(() => owedWithin(state.debts, 14), [state.debts])
  const due14 = owed14.total
  const balanceAfterApplying =
    state.bankBalance.amount + incomeAmount - split.toExtraDebt - split.toSavings
  const leavesShort = balanceAfterApplying < due14

  // Linked once in Settings; from then on the balance can be pulled from here.
  const stripeLinked = loadBankLink() !== null

  /** Folds any not-yet-logged income in the input box into the bank balance + entry log. */
  function commitPendingIncome(s: AppState): AppState {
    if (incomeAmount <= 0) return s
    return {
      ...s,
      bankBalance: { amount: s.bankBalance.amount + incomeAmount, updatedAt: today() },
      incomeEntries: [...s.incomeEntries, { id: uid(), date: today(), amount: incomeAmount }],
    }
  }

  function saveBalance() {
    const amount = Number(balanceInput)
    if (Number.isNaN(amount)) return
    setState((s) => ({ ...s, bankBalance: { amount, updatedAt: today() } }))
    setBalanceEdit(false)
  }

  function logIncome() {
    if (incomeAmount <= 0) return
    setState(commitPendingIncome)
    setIncomeInput('')
  }

  // Both apply actions commit any pending (not-yet-logged) income first, so the
  // amount they subtract was actually added to the bank balance in the same update.
  function applyToSavings() {
    if (split.toSavings <= 0) return
    setState((s) => {
      const c = commitPendingIncome(s)
      return {
        ...c,
        bankBalance: { ...c.bankBalance, amount: c.bankBalance.amount - split.toSavings },
        savingsBalance: c.savingsBalance + split.toSavings,
      }
    })
    setIncomeInput('')
  }

  function applyExtraToDebt() {
    if (split.toExtraDebt <= 0 || !split.priorityDebt) return
    const targetId = split.priorityDebt.id
    // Routed through applyPayment so it lands in the payment history and can be
    // undone like any other payment. An extra payment is on top of the schedule,
    // so it must not advance the due date.
    setState((s) =>
      applyPayment(commitPendingIncome(s), {
        debtId: targetId,
        amount: split.toExtraDebt,
        date: today(),
        fromBank: true,
        advanceDue: false,
      }),
    )
    setIncomeInput('')
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <Card>
        <div className="grid grid-cols-2 gap-4">
          <StatTile
            label="Bank balance"
            value={formatCurrency(state.bankBalance.amount)}
            sub={`updated ${formatDate(state.bankBalance.updatedAt)}`}
            accent={state.bankBalance.amount < 0 ? 'var(--status-critical)' : undefined}
          />
          <StatTile
            label="Savings set aside"
            value={formatCurrency(state.savingsBalance)}
            accent="var(--status-good)"
          />
        </div>
        {/* Every way to bring the balance up to date, in one place. */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-xs font-medium"
            style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}
            onClick={() => {
              setBalanceInput(String(state.bankBalance.amount))
              setBalanceEdit((v) => !v)
            }}
          >
            {balanceEdit ? 'Cancel' : 'Edit'}
          </button>
          <ScreenshotImport state={state} setState={setState} />
          {stripeLinked && (
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}
              onClick={onGoToSettings}
            >
              Stripe ›
            </button>
          )}
        </div>
        {balanceEdit && (
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{
                background: 'var(--surface-page)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="button"
              onClick={saveBalance}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: 'var(--cat-installment)', color: 'white' }}
            >
              Save
            </button>
          </div>
        )}
      </Card>

      <DueAlertCard state={state} />

      <WeekTargetCard state={state} />

      <CommandBar
        state={state}
        setState={setState}
        action={
          <ScreenshotImport
            state={state}
            setState={setState}
            label="📷"
            className="rounded-lg px-2 py-1 text-xs"
            style={{ background: 'var(--surface-page)', color: 'var(--text-muted)' }}
          />
        }
      />

      <Card>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Log this week's income
        </h2>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={incomeInput}
            onChange={(e) => setIncomeInput(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{
              background: 'var(--surface-page)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            type="button"
            onClick={logIncome}
            disabled={incomeAmount <= 0}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--status-good)', color: 'white' }}
          >
            Log
          </button>
        </div>

        <div className="mt-4 rounded-xl p-3" style={{ background: 'var(--surface-page)' }}>
          <p className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            {split.available > 0 ? (
              <>
                Suggested split of {formatCurrency(split.available)} — this check only. Your
                existing balance stays in checking.
              </>
            ) : (
              <>Enter this week's check above to see how to split it.</>
            )}
          </p>
          {split.available > 0 && split.shortfall > 0 && (
            <p className="mb-2 text-xs font-medium" style={{ color: 'var(--status-critical)' }}>
              ⚠ This check is {formatCurrency(split.shortfall)} short of what it has to cover
              this week ({formatCurrency(split.weeklyCommitted)}/wk in debt minimums and living
              costs) — the gap comes out of your checking balance.
            </p>
          )}
          {split.available > 0 ? (
            <>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Minimum debt payments (weekly share)
                  </span>
                  <span className="tabular-nums">{formatCurrency(split.weeklyMinimum)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Living costs (weekly share)
                    {split.weeklyExpenses === 0 && (
                      <span className="ml-1 text-xs" style={{ color: 'var(--status-warning)' }}>
                        none entered
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums">{formatCurrency(split.weeklyExpenses)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Extra toward {split.priorityDebt?.name ?? '—'}
                  </span>
                  <span className="tabular-nums">{formatCurrency(split.toExtraDebt)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span style={{ color: 'var(--text-secondary)' }}>To savings</span>
                  <span className="tabular-nums">{formatCurrency(split.toSavings)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Stays in checking
                    <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      (no action)
                    </span>
                  </span>
                  <span className="tabular-nums" style={{ color: 'var(--status-good)' }}>
                    {formatCurrency(split.toChecking)}
                  </span>
                </div>
              </div>
              {due14 > 0 && (
                <div
                  className="mt-3 rounded-lg p-2 text-xs"
                  style={{ background: 'var(--surface-card)' }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Due in the next 14 days
                      {owed14.overdue > 0 && (
                        <span style={{ color: 'var(--status-critical)' }}>
                          {' '}· incl. {formatCurrency(owed14.overdue)} past due
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums">{formatCurrency(due14)}</span>
                  </div>
                  {leavesShort ? (
                    <p className="mt-1 font-medium" style={{ color: 'var(--status-critical)' }}>
                      ⚠ Applying this would leave {formatCurrency(balanceAfterApplying)} against{' '}
                      {formatCurrency(due14)} of upcoming payments. Hold some back.
                    </p>
                  ) : (
                    <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
                      {formatCurrency(balanceAfterApplying)} left afterwards — covers it.
                    </p>
                  )}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={applyExtraToDebt}
                  disabled={split.toExtraDebt <= 0}
                  className="flex-1 rounded-lg py-2 text-xs font-medium disabled:opacity-40"
                  style={{ background: 'var(--cat-installment)', color: 'white' }}
                >
                  Apply extra to debt
                </button>
                <button
                  type="button"
                  onClick={applyToSavings}
                  disabled={split.toSavings <= 0}
                  className="flex-1 rounded-lg py-2 text-xs font-medium disabled:opacity-40"
                  style={{ background: 'var(--status-good)', color: 'white' }}
                >
                  Move to savings
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>
                For reference — weekly share of minimums
              </span>
              <span className="tabular-nums">{formatCurrency(split.weeklyMinimum)}</span>
            </div>
          )}
        </div>
      </Card>

      <RunwayCard state={state} onAddExpenses={onGoToIncome} />
    </div>
  )
}
