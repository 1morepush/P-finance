import { useState } from 'react'
import type { AppState, IncomeSource } from '../types'
import { Card } from '../components/Card'
import { Modal } from '../components/Modal'
import { IncomeForm } from '../components/IncomeForm'
import { formatCurrency, formatDate } from '../lib/finance'

export function Income({
  state,
  setState,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}) {
  const [editing, setEditing] = useState<IncomeSource | 'new' | null>(null)

  function save(form: Omit<IncomeSource, 'id'>) {
    setState((s) => {
      if (editing && editing !== 'new') {
        return {
          ...s,
          incomeSources: s.incomeSources.map((src) =>
            src.id === editing.id ? { ...form, id: editing.id } : src,
          ),
        }
      }
      return { ...s, incomeSources: [...s.incomeSources, { ...form, id: crypto.randomUUID() }] }
    })
    setEditing(null)
  }

  function remove(id: string) {
    setState((s) => ({ ...s, incomeSources: s.incomeSources.filter((src) => src.id !== id) }))
    setEditing(null)
  }

  const recentEntries = [...state.incomeEntries].reverse().slice(0, 10)

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Income sources</h1>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="rounded-lg px-3 py-1.5 text-sm font-medium"
          style={{ background: 'var(--cat-installment)', color: 'white' }}
        >
          + Add source
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {state.incomeSources.map((src) => (
          <Card key={src.id} className="cursor-pointer" >
            <div onClick={() => setEditing(src)} className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: src.active ? 'var(--status-good)' : 'var(--text-muted)' }}
                  />
                  <span className="font-medium">{src.name}</span>
                </div>
                {src.notes && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {src.notes}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="tabular-nums font-semibold">{formatCurrency(src.amount)}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {src.frequency}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {recentEntries.length > 0 && (
        <>
          <h2 className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Logged income
          </h2>
          <Card>
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
              {recentEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-2 text-sm first:pt-0 last:pb-0">
                  <span style={{ color: 'var(--text-secondary)' }}>{formatDate(entry.date)}</span>
                  <span className="tabular-nums">{formatCurrency(entry.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {editing && (
        <Modal title={editing === 'new' ? 'Add income source' : 'Edit income source'} onClose={() => setEditing(null)}>
          <IncomeForm
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
              Delete source
            </button>
          )}
        </Modal>
      )}
    </div>
  )
}
