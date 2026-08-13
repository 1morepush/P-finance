import { useState } from 'react'
import type { Debt, DebtCategory } from '../types'

const inputStyle = {
  background: 'var(--surface-page)',
  borderColor: 'var(--border)',
  color: 'var(--text-primary)',
}

const emptyDebt: Omit<Debt, 'id'> = {
  name: '',
  category: 'installment',
  status: 'active',
  balance: 0,
  apr: undefined,
  monthlyPayment: undefined,
  payoffDate: undefined,
  notes: '',
}

export function DebtForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Debt
  onSave: (debt: Omit<Debt, 'id'>) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<Omit<Debt, 'id'>>(initial ?? emptyDebt)

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!form.name.trim()) return
        onSave(form)
      }}
    >
      <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
        Name
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-lg border px-3 py-2 text-sm"
          style={inputStyle}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Category
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as DebtCategory })}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          >
            <option value="installment">Installment</option>
            <option value="revolving">Revolving</option>
            <option value="personal">Personal</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Status
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as Debt['status'] })}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          >
            <option value="active">Active</option>
            <option value="paid">Paid off</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Balance ($)
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={form.balance}
            onChange={(e) => setForm({ ...form, balance: Number(e.target.value) })}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          APR (%)
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={form.apr ?? ''}
            onChange={(e) =>
              setForm({ ...form, apr: e.target.value === '' ? undefined : Number(e.target.value) })
            }
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Monthly payment ($)
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={form.monthlyPayment ?? ''}
            onChange={(e) =>
              setForm({
                ...form,
                monthlyPayment: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Payoff date
          <input
            type="date"
            value={form.payoffDate ?? ''}
            onChange={(e) => setForm({ ...form, payoffDate: e.target.value || undefined })}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
        Notes
        <textarea
          value={form.notes ?? ''}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
          className="rounded-lg border px-3 py-2 text-sm"
          style={inputStyle}
        />
      </label>

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
          className="flex-1 rounded-lg py-2 text-sm font-medium"
          style={{ background: 'var(--cat-installment)', color: 'white' }}
        >
          Save
        </button>
      </div>
    </form>
  )
}
