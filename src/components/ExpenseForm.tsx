import { useState } from 'react'
import type { Expense, ExpenseCadence } from '../types'
import { formatCurrency } from '../lib/finance'
import { expenseMonthly, type ExpenseInput } from '../lib/budget'

const inputStyle = {
  background: 'var(--surface-page)',
  borderColor: 'var(--border)',
  color: 'var(--text-primary)',
}

const CADENCES: [ExpenseCadence, string][] = [
  ['monthly', 'Monthly'],
  ['biweekly', 'Every 2 weeks'],
  ['weekly', 'Weekly'],
]

/** Common ones, so the list can be filled in without typing much. */
const SUGGESTIONS = ['Rent', 'Groceries', 'Phone', 'Car insurance', 'Gas', 'Utilities', 'Subscriptions']

export function ExpenseForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Expense
  onSave: (input: ExpenseInput) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [cadence, setCadence] = useState<ExpenseCadence>(initial?.cadence ?? 'monthly')
  const [essential, setEssential] = useState(initial?.essential ?? true)

  const value = Number(amount) || 0
  const monthly = expenseMonthly({ id: '', name, amount: value, cadence, essential })

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim() || value <= 0) return
        onSave({ name: name.trim(), amount: value, cadence, essential })
      }}
    >
      <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
        What is it
        <input
          autoFocus
          value={name}
          placeholder="Rent"
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={inputStyle}
        />
      </label>

      {!initial && !name && (
        <div className="flex flex-wrap gap-1">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setName(s)}
              className="rounded-lg px-2 py-1 text-xs"
              style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Amount ($)
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          How often
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value as ExpenseCadence)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          >
            {CADENCES.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={essential} onChange={(e) => setEssential(e.target.checked)} />
        Essential — can't simply be cut
      </label>

      {value > 0 && cadence !== 'monthly' && (
        <p className="rounded-lg p-2 text-xs" style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}>
          Works out to <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(monthly)}</strong> a month.
        </p>
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
          disabled={!name.trim() || value <= 0}
          className="flex-1 rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          style={{ background: 'var(--cat-installment)', color: 'white' }}
        >
          {initial ? 'Save' : 'Add expense'}
        </button>
      </div>
    </form>
  )
}
