import { useState } from 'react'
import type { AppState, Debt, PriorityTier } from '../types'
import { categoryOf, PRODUCT_LABEL, TIER_LABEL } from '../types'
import { Card } from '../components/Card'
import { Modal } from '../components/Modal'
import { DebtForm } from '../components/DebtForm'
import {
  formatCurrency,
  formatDate,
  formatDue,
  orderByStrategy,
  potentialDebts,
  totalCleared,
} from '../lib/finance'

const CATEGORY_COLOR = {
  installment: 'var(--cat-installment)',
  revolving: 'var(--cat-revolving)',
  personal: 'var(--cat-personal)',
} as const

const TIER_COLOR: Record<PriorityTier, string> = {
  0: 'var(--status-critical)',
  1: 'var(--status-serious)',
  2: 'var(--status-warning)',
  3: 'var(--cat-revolving)',
  4: 'var(--cat-personal)',
}

function DebtCard({ debt, badge, onClick }: { debt: Debt; badge?: string; onClick: () => void }) {
  return (
    <Card className="cursor-pointer">
      <div onClick={onClick}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {badge && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: 'var(--status-good)', color: 'white' }}
                >
                  {badge}
                </span>
              )}
              {debt.status === 'potential' && (
                <span
                  className="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ borderColor: 'var(--status-warning)', color: 'var(--status-warning)' }}
                >
                  UNCONFIRMED
                </span>
              )}
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: CATEGORY_COLOR[categoryOf(debt)] }}
              />
              <span className="font-medium">{debt.name}</span>
            </div>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              {PRODUCT_LABEL[debt.product]}
              {debt.notes ? ` · ${debt.notes}` : ''}
            </p>
          </div>
          <span className="tabular-nums shrink-0 font-semibold">{formatCurrency(debt.balance)}</span>
        </div>
        <div
          className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          {debt.apr > 0 && <span>{debt.apr}% APR</span>}
          {debt.monthlyPayment && <span>{formatCurrency(debt.monthlyPayment)}/mo</span>}
          {debt.nextDue && <span>next {formatDue(debt.nextDue)}</span>}
          {debt.finalPaymentDate && <span>ends {formatDate(debt.finalPaymentDate)}</span>}
        </div>
      </div>
    </Card>
  )
}

export function Debts({
  state,
  setState,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}) {
  const [editing, setEditing] = useState<Debt | 'new' | null>(null)

  const ordered = orderByStrategy(state.debts, state.settings.strategy)
  const potential = potentialDebts(state.debts)
  const byTier = state.settings.strategy === 'tier'

  const tiers = ([0, 1, 2, 3, 4] as PriorityTier[])
    .map((t) => ({ tier: t, debts: ordered.filter((d) => d.priorityTier === t) }))
    .filter((g) => g.debts.length > 0)

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
        {byTier
          ? 'Grouped by priority tier. Change the strategy in Settings.'
          : state.settings.strategy === 'avalanche'
            ? 'Ordered by highest APR first (avalanche). Change this in Settings.'
            : 'Ordered by smallest balance first (snowball). Change this in Settings.'}
      </p>

      {byTier ? (
        tiers.map(({ tier, debts }) => (
          <section key={tier} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                style={{ background: TIER_COLOR[tier], color: '#0d0d0d' }}
              >
                TIER {tier}
              </span>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {TIER_LABEL[tier]}
              </h2>
              <span className="tabular-nums ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
                {formatCurrency(debts.reduce((s, d) => s + d.balance, 0))}
              </span>
            </div>
            {debts.map((d, i) => (
              <DebtCard
                key={d.id}
                debt={d}
                badge={tier === tiers[0].tier && i === 0 ? 'NEXT TARGET' : undefined}
                onClick={() => setEditing(d)}
              />
            ))}
          </section>
        ))
      ) : (
        <div className="flex flex-col gap-3">
          {ordered.map((d, i) => (
            <DebtCard
              key={d.id}
              debt={d}
              badge={i === 0 ? 'NEXT TARGET' : undefined}
              onClick={() => setEditing(d)}
            />
          ))}
        </div>
      )}

      {potential.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Unconfirmed — not counted in totals
          </h2>
          {potential.map((d) => (
            <DebtCard key={d.id} debt={d} onClick={() => setEditing(d)} />
          ))}
        </section>
      )}

      {state.clearedDebts.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="mt-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Cleared 🎉
            </h2>
            <span
              className="tabular-nums ml-auto text-xs font-semibold"
              style={{ color: 'var(--status-good)' }}
            >
              {formatCurrency(totalCleared(state.clearedDebts))} paid off
            </span>
          </div>
          <Card>
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
              {[...state.clearedDebts]
                .sort((a, b) => b.dateCleared.localeCompare(a.dateCleared))
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="min-w-0 truncate">{c.name}</span>
                    <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(c.dateCleared)}
                    </span>
                    <span
                      className="tabular-nums shrink-0 font-medium"
                      style={{ color: 'var(--status-good)' }}
                    >
                      {formatCurrency(c.amountCleared)}
                    </span>
                  </div>
                ))}
            </div>
          </Card>
        </section>
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
