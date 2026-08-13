import { useState } from 'react'
import type { IncomeFrequency, IncomeSource } from '../types'

const inputStyle = {
  background: 'var(--surface-page)',
  borderColor: 'var(--border)',
  color: 'var(--text-primary)',
}

const empty: Omit<IncomeSource, 'id'> = {
  name: '',
  amount: 0,
  frequency: 'variable',
  active: true,
  notes: '',
}

export function IncomeForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: IncomeSource
  onSave: (source: Omit<IncomeSource, 'id'>) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<Omit<IncomeSource, 'id'>>(initial ?? empty)

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
          Typical amount ($)
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Frequency
          <select
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value as IncomeFrequency })}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
            <option value="variable">Variable</option>
            <option value="one-time">One-time</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
        />
        Active
      </label>

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
