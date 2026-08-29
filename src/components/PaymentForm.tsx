import { useState } from 'react'
import type { AppState } from '../types'
import { activeDebts, formatCurrency, formatDate } from '../lib/finance'
import { nextDueAfter, type PaymentInput } from '../lib/payments'
import { today } from '../lib/schedule'

const inputStyle = {
  background: 'var(--surface-page)',
  borderColor: 'var(--border)',
  color: 'var(--text-primary)',
}

export function PaymentForm({
  state,
  initialDebtId,
  onSave,
  onCancel,
}: {
  state: AppState
  initialDebtId?: string
  onSave: (input: PaymentInput) => void
  onCancel: () => void
}) {
  const debts = activeDebts(state.debts)
  const [debtId, setDebtId] = useState(initialDebtId ?? debts[0]?.id ?? '')
  const debt = debts.find((d) => d.id === debtId)

  // Pre-fill with the scheduled payment — the common case is paying exactly that.
  const [amount, setAmount] = useState(String(debt?.monthlyPayment ?? ''))
  const [date, setDate] = useState(today())
  const [fromBank, setFromBank] = useState(true)
  const [advanceDue, setAdvanceDue] = useState(true)

  const value = Number(amount) || 0
  const advanceTo = debt ? nextDueAfter(debt) : null
  const clears = debt ? value >= debt.balance : false

  function pickDebt(id: string) {
    setDebtId(id)
    const next = debts.find((d) => d.id === id)
    setAmount(String(next?.monthlyPayment ?? ''))
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!debt || value <= 0) return
        onSave({ debtId, amount: value, date, fromBank, advanceDue })
      }}
    >
      <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
        Debt
        <select
          value={debtId}
          onChange={(e) => pickDebt(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={inputStyle}
        >
          {debts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} — {formatCurrency(d.balance)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Amount paid ($)
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
      </div>

      {debt && debt.monthlyPayment && (
        <button
          type="button"
          onClick={() => setAmount(String(debt.monthlyPayment))}
          className="self-start rounded-lg px-2 py-1 text-xs"
          style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}
        >
          Use scheduled {formatCurrency(debt.monthlyPayment)}
        </button>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={fromBank}
          onChange={(e) => setFromBank(e.target.checked)}
        />
        Deduct from bank balance
      </label>

      {advanceTo && !clears && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={advanceDue}
            onChange={(e) => setAdvanceDue(e.target.checked)}
          />
          Move next due date to {formatDate(advanceTo)}
        </label>
      )}

      {debt && value > 0 && (
        <div className="rounded-lg p-2 text-xs" style={{ background: 'var(--surface-page)' }}>
          {clears ? (
            <span style={{ color: 'var(--status-good)' }}>
              This clears {debt.name} — it moves to the cleared log. 🎉
            </span>
          ) : (
            <span style={{ color: 'var(--text-secondary)' }}>
              {debt.name}: {formatCurrency(debt.balance)} →{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(debt.balance - value)}
              </strong>
            </span>
          )}
        </div>
      )}

      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg py-2 text-sm font-medium"
          style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!debt || value <= 0}
          className="flex-1 rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          style={{ background: 'var(--status-good)', color: 'white' }}
        >
          Log payment
        </button>
      </div>
    </form>
  )
}
