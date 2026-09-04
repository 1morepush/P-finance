import { useState } from 'react'
import type { Debt, DebtProduct, DebtStatus, PriorityTier } from '../types'
import { PRODUCT_LABEL, TIER_LABEL } from '../types'

const inputStyle = {
  background: 'var(--surface-page)',
  borderColor: 'var(--border)',
  color: 'var(--text-primary)',
}

const emptyDebt: Omit<Debt, 'id'> = {
  name: '',
  product: 'affirm_pay_monthly',
  status: 'active',
  priorityTier: 1,
  balance: 0,
  apr: 0,
  monthlyPayment: undefined,
  nextDue: undefined,
  finalPaymentDate: undefined,
  notes: '',
}

const PRODUCTS = Object.keys(PRODUCT_LABEL) as DebtProduct[]
const TIERS = [0, 1, 2, 3, 4] as PriorityTier[]

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

      <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
        Lender / product
        <select
          value={form.product}
          onChange={(e) => setForm({ ...form, product: e.target.value as DebtProduct })}
          className="rounded-lg border px-3 py-2 text-sm"
          style={inputStyle}
        >
          {PRODUCTS.map((p) => (
            <option key={p} value={p}>
              {PRODUCT_LABEL[p]}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Priority tier
          <select
            value={form.priorityTier}
            onChange={(e) =>
              setForm({ ...form, priorityTier: Number(e.target.value) as PriorityTier })
            }
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t} — {TIER_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Status
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as DebtStatus })}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          >
            <option value="active">Active</option>
            <option value="potential">Potential (unconfirmed)</option>
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
            value={form.apr}
            onChange={(e) => setForm({ ...form, apr: Number(e.target.value) })}
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
          Final payment date
          <input
            type="date"
            value={form.finalPaymentDate ?? ''}
            onChange={(e) => setForm({ ...form, finalPaymentDate: e.target.value || undefined })}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
        Next due — a date, or a word like ASAP / flexible
        <input
          value={form.nextDue ?? ''}
          placeholder="2026-09-13 or ASAP"
          onChange={(e) => setForm({ ...form, nextDue: e.target.value || undefined })}
          className="rounded-lg border px-3 py-2 text-sm"
          style={inputStyle}
        />
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={form.autoMarkPaid !== false}
          onChange={(e) => setForm({ ...form, autoMarkPaid: e.target.checked })}
        />
        <span>
          Assume paid when the due date passes
          <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
            Turn off for anything you pay by hand or might miss.
          </span>
        </span>
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
