import { useMemo, useState } from 'react'
import type { AppState } from '../types'
import { Card } from '../components/Card'
import { StatTile } from '../components/StatTile'
import { CategoryBar } from '../components/CategoryBar'
import {
  activeDebts,
  calculateWeeklySplit,
  estimatePayoffMonths,
  formatCurrency,
  formatDate,
  latestScheduledPayoffDate,
  totalDebt,
} from '../lib/finance'

export function Dashboard({
  state,
  setState,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}) {
  const [incomeInput, setIncomeInput] = useState('')
  const [balanceEdit, setBalanceEdit] = useState(false)
  const [balanceInput, setBalanceInput] = useState(String(state.bankBalance.amount))

  const incomeAmount = Number(incomeInput) || 0
  const split = useMemo(() => calculateWeeklySplit(state, incomeAmount), [state, incomeAmount])
  const debts = activeDebts(state.debts)
  const debtTotal = totalDebt(state.debts)
  const lastPayoff = latestScheduledPayoffDate(state.debts)

  const appleCard = state.debts.find((d) => d.id === 'debt-apple-card')
  const appleMonths =
    appleCard && appleCard.apr && appleCard.monthlyPayment
      ? estimatePayoffMonths(appleCard.balance, appleCard.apr, appleCard.monthlyPayment)
      : null
  const appleMonthsBoosted =
    appleCard && appleCard.apr && appleCard.monthlyPayment
      ? estimatePayoffMonths(
          appleCard.balance,
          appleCard.apr,
          appleCard.monthlyPayment + split.toExtraDebt,
        )
      : null

  const categorySegments = [
    {
      label: 'Installment',
      value: debts.filter((d) => d.category === 'installment').reduce((s, d) => s + d.balance, 0),
      color: 'var(--cat-installment)',
    },
    {
      label: 'Revolving',
      value: debts.filter((d) => d.category === 'revolving').reduce((s, d) => s + d.balance, 0),
      color: 'var(--cat-revolving)',
    },
    {
      label: 'Personal',
      value: debts.filter((d) => d.category === 'personal').reduce((s, d) => s + d.balance, 0),
      color: 'var(--cat-personal)',
    },
  ]

  function saveBalance() {
    const amount = Number(balanceInput)
    if (Number.isNaN(amount)) return
    setState((s) => ({ ...s, bankBalance: { amount, updatedAt: new Date().toISOString().slice(0, 10) } }))
    setBalanceEdit(false)
  }

  /** Folds any not-yet-logged income in the input box into the bank balance + entry log. */
  function commitPendingIncome(s: AppState): AppState {
    if (incomeAmount <= 0) return s
    return {
      ...s,
      bankBalance: {
        amount: s.bankBalance.amount + incomeAmount,
        updatedAt: new Date().toISOString().slice(0, 10),
      },
      incomeEntries: [
        ...s.incomeEntries,
        {
          id: crypto.randomUUID(),
          date: new Date().toISOString().slice(0, 10),
          amount: incomeAmount,
        },
      ],
    }
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
      const committed = commitPendingIncome(s)
      return {
        ...committed,
        bankBalance: { ...committed.bankBalance, amount: committed.bankBalance.amount - split.toSavings },
        savingsBalance: committed.savingsBalance + split.toSavings,
      }
    })
    setIncomeInput('')
  }

  function applyExtraToDebt() {
    if (split.toExtraDebt <= 0 || !split.priorityDebt) return
    const targetId = split.priorityDebt.id
    setState((s) => {
      const committed = commitPendingIncome(s)
      return {
        ...committed,
        bankBalance: { ...committed.bankBalance, amount: committed.bankBalance.amount - split.toExtraDebt },
        debts: committed.debts.map((d) =>
          d.id === targetId ? { ...d, balance: Math.max(d.balance - split.toExtraDebt, 0) } : d,
        ),
      }
    })
    setIncomeInput('')
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <Card>
        <div className="flex items-center justify-between">
          <StatTile
            label="Bank balance"
            value={formatCurrency(state.bankBalance.amount)}
            sub={`updated ${formatDate(state.bankBalance.updatedAt)}`}
          />
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
        </div>
        {balanceEdit && (
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ background: 'var(--surface-page)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
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
            style={{ background: 'var(--surface-page)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
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
            Suggested split of {formatCurrency(split.available)} (bank balance + this entry)
          </p>
          {split.shortfall > 0 && (
            <p className="mb-2 text-xs font-medium" style={{ color: 'var(--status-critical)' }}>
              ⚠ Short {formatCurrency(split.shortfall)} of this month's weekly-equivalent minimum
              debt payments ({formatCurrency(split.weeklyMinimum)}/wk).
            </p>
          )}
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>Minimum debt payments (weekly share)</span>
              <span className="tabular-nums">{formatCurrency(split.weeklyMinimum)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>
                Extra toward {split.priorityDebt?.name ?? '—'}
              </span>
              <span className="tabular-nums">{formatCurrency(split.toExtraDebt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>To savings</span>
              <span className="tabular-nums">{formatCurrency(split.toSavings)}</span>
            </div>
          </div>
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
        </div>
      </Card>

      <Card>
        <div className="grid grid-cols-2 gap-4">
          <StatTile label="Total active debt" value={formatCurrency(debtTotal)} />
          <StatTile
            label="Savings set aside"
            value={formatCurrency(state.savingsBalance)}
            accent="var(--status-good)"
          />
        </div>
        <div className="mt-4">
          <CategoryBar segments={categorySegments} />
        </div>
        {lastPayoff && (
          <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            All fixed-schedule installment debt clears by {formatDate(lastPayoff)} at minimum payments.
          </p>
        )}
      </Card>

      {appleCard && appleCard.balance > 0 && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Apple Card payoff projection
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {formatCurrency(appleCard.balance)} at {appleCard.apr}% APR
          </p>
          <div className="mt-2 flex gap-4 text-sm">
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>At minimum (${appleCard.monthlyPayment}/mo): </span>
              <span className="tabular-nums font-medium">
                {appleMonths ? `${appleMonths} mo` : 'never clears interest'}
              </span>
            </div>
            {split.toExtraDebt > 0 && split.priorityDebt?.id === appleCard.id && (
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>With this week's extra: </span>
                <span className="tabular-nums font-medium" style={{ color: 'var(--status-good)' }}>
                  {appleMonthsBoosted ? `${appleMonthsBoosted} mo` : '—'}
                </span>
              </div>
            )}
          </div>
        </Card>
      )}

      {state.pendingClaims.length > 0 && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Potential upside (not counted in your plan)
          </h2>
          {state.pendingClaims.map((c) => (
            <div key={c.id} className="text-sm">
              <div className="flex items-center justify-between">
                <span>{c.name}</span>
                <span className="tabular-nums" style={{ color: 'var(--status-warning)' }}>
                  {formatCurrency(c.low)}–{formatCurrency(c.high)}
                </span>
              </div>
              {c.notes && (
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {c.notes}
                </p>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
