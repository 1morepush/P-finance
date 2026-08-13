import { useState } from 'react'
import type { AppState, Debt } from '../types'
import { Card } from '../components/Card'
import { Modal } from '../components/Modal'
import { DebtForm } from '../components/DebtForm'
import { formatCurrency, formatDate, orderByStrategy } from '../lib/finance'

const CATEGORY_COLOR: Record<Debt['category'], string> = {
  installment: 'var(--cat-installment)',
  revolving: 'var(--cat-revolving)',
  personal: 'var(--cat-personal)',
}

export function Debts({
  state,
  setState,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}) {
  const [editing, setEditing] = useState<Debt | 'new' | null>(null)

  const active = orderByStrategy(state.debts, state.settings.strategy)
  const paid = state.debts.filter((d) => d.status === 'paid')

  function save(form: Omit<Debt, 'id'>) {
    setState((s) => {
      if (editing && editing !== 'new') {
        return {
          ...s,
          debts: s.debts.map((d) => (d.id === editing.id ? { ...form, id: editing.id } : d)),
        }
      }
      return { ...s, debts: [...s.debts, { ...form, id: crypto.randomUUID() }] }
    })
    setEditing(null)
  }

  function remove(id: string) {
    setState((s) => ({ ...s, debts: s.debts.filter((d) => d.id !== id) }))
    setEditing(null)
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Debts</h1>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="rounded-lg px-3 py-1.5 text-sm font-medium"
          style={{ background: 'var(--cat-installment)', color: 'white' }}
        >
          + Add debt
        </button>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Ordered by {state.settings.strategy === 'avalanche' ? 'highest APR first (avalanche)' : 'smallest balance first (snowball)'}.
        Change this in Settings.
      </p>

      <div className="flex flex-col gap-3">
        {active.map((d, i) => (
          <Card key={d.id} className="cursor-pointer" >
            <div onClick={() => setEditing(d)}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {i === 0 && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ background: 'var(--status-good)', color: 'white' }}
                      >
                        NEXT TARGET
                      </span>
                    )}
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: CATEGORY_COLOR[d.category] }}
                    />
                    <span className="font-medium">{d.name}</span>
                  </div>
                  {d.notes && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {d.notes}
                    </p>
                  )}
                </div>
                <span className="tabular-nums font-semibold">{formatCurrency(d.balance)}</span>
              </div>
              <div className="mt-2 flex gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {d.apr ? <span>{d.apr}% APR</span> : null}
                {d.monthlyPayment ? <span>{formatCurrency(d.monthlyPayment)}/mo</span> : null}
                {d.payoffDate ? <span>payoff {formatDate(d.payoffDate)}</span> : null}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {paid.length > 0 && (
        <>
          <h2 className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Paid off 🎉
          </h2>
          <div className="flex flex-col gap-2">
            {paid.map((d) => (
              <Card key={d.id} className="cursor-pointer opacity-70" >
                <div onClick={() => setEditing(d)} className="flex items-center justify-between">
                  <span>{d.name}</span>
                  <span className="text-xs" style={{ color: 'var(--status-good)' }}>
                    {d.notes}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {editing && (
        <Modal title={editing === 'new' ? 'Add debt' : 'Edit debt'} onClose={() => setEditing(null)}>
          <DebtForm
            initial={editing === 'new' ? undefined : editing}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
          {editing !== 'new' && (
            <button
              type="button"
              onClick={() => remove(editing.id)}
              className="mt-3 w-full rounded-lg py-2 text-sm font-medium"
              style={{ background: 'transparent', color: 'var(--status-critical)' }}
            >
              Delete debt
            </button>
          )}
        </Modal>
      )}
    </div>
  )
}
