import { useState } from 'react'
import type { AppState } from '../types'
import { Card } from './Card'
import { formatCurrency } from '../lib/finance'
import { formatShortDate, today } from '../lib/schedule'
import { BUDGET, budgetAmount, saveBudget, safeToSpend, type BudgetId } from '../lib/safe'

const inputStyle = { background: 'var(--surface-page)', borderColor: 'var(--border)', color: 'var(--text-primary)' }
const muted = { color: 'var(--text-muted)' }
const secondary = { color: 'var(--text-secondary)' }

function Line({ label, amount, minus }: { label: string; amount: number; minus?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span style={secondary}>{label}</span>
      <span className="tabular-nums shrink-0 whitespace-nowrap">
        {minus ? '− ' : ''}
        {formatCurrency(amount)}
      </span>
    </div>
  )
}

/**
 * One number for "can I afford this": what is in the bank, less the floor,
 * less everything due before the next paycheck, less food and gas until then.
 */
export function SafeCard({
  state,
  setState,
  now = today(),
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
  now?: string
}) {
  const s = safeToSpend(state, now)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<Record<BudgetId, string>>>({})
  const tone = s.free > 0 ? 'var(--status-good)' : 'var(--status-critical)'
  const until = s.payday ? `until payday, ${formatShortDate(s.payday)}` : `through ${formatShortDate(s.until)}`

  function startEdit() {
    setDraft(Object.fromEntries(BUDGET.map((b) => [b.id, budgetAmount(state, b.id)?.toString() ?? ''])))
    setEditing(true)
  }
  function save() {
    setState((st) => saveBudget(st, Object.fromEntries(BUDGET.map((b) => [b.id, Number(draft[b.id]) || 0]))))
    setEditing(false)
  }

  return (
    <Card>
      <div data-find="safe">
        <div className="text-xs" style={muted}>
          Safe to spend {until}
        </div>
        <div className="tabular-nums text-3xl font-semibold" style={{ color: tone }} data-safe={s.free}>
          {formatCurrency(Math.max(s.free, 0))}
        </div>
        {s.free <= 0 && (
          <p className="mt-1 text-xs" style={{ color: 'var(--status-critical)' }}>
            {formatCurrency(-s.free)} short of covering your floor and what's due. Spend only on essentials.
          </p>
        )}
      </div>

      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="mt-1 text-xs font-medium"
        style={{ color: 'var(--cat-installment)' }}
      >
        {open ? 'Hide the working' : 'How this is worked out'}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1 rounded-lg p-2" style={{ background: 'var(--surface-page)' }}>
          <Line label="In the bank" amount={s.bank} />
          <Line label="Kept as your floor" amount={s.floor} minus />
          <Line label={`Due by ${formatShortDate(s.until)} (${s.dueList.length})`} amount={s.due} minus />
          {s.dueList.map((p) => (
            <div key={`${p.debtId}-${p.date}`} className="flex justify-between gap-2 pl-3 text-[11px]" style={muted}>
              <span className="min-w-0 truncate">
                {p.debtName} · {formatShortDate(p.date)}
              </span>
              <span className="tabular-nums shrink-0">{formatCurrency(p.amount)}</span>
            </div>
          ))}
          <Line label="Food, gas and other everyday costs until then" amount={s.living} minus />
        </div>
      )}

      {s.livingMissing && !editing && (
        <button
          type="button"
          onClick={startEdit}
          className="mt-2 w-full rounded-lg p-2 text-left text-xs"
          style={{ background: 'var(--surface-page)', color: 'var(--status-warning)' }}
        >
          Food, gas, phone and car insurance aren't entered, so this number is too generous.{' '}
          <span className="font-medium underline">Add them</span>
        </button>
      )}
      {!s.livingMissing && !editing && (
        <button type="button" onClick={startEdit} className="mt-2 block text-[11px] underline" style={muted}>
          Change food, gas, phone or insurance
        </button>
      )}

      {editing && (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            {BUDGET.map((b) => (
              <label key={b.id} className="flex flex-col gap-1 text-xs" style={secondary}>
                {b.name}, {b.per}
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  placeholder={b.placeholder}
                  value={draft[b.id] ?? ''}
                  onChange={(e) => setDraft({ ...draft, [b.id]: e.target.value })}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={inputStyle}
                />
              </label>
            ))}
          </div>
          <p className="text-[11px]" style={muted}>
            Your best guess is fine. Leave one blank if you don't pay it. They're saved with your living
            costs on the Income tab.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className="flex-1 rounded-lg py-2 text-sm" style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}>
              Cancel
            </button>
            <button type="submit" className="flex-1 rounded-lg py-2 text-sm font-medium" style={{ background: 'var(--status-good)', color: 'white' }}>
              Save
            </button>
          </div>
        </form>
      )}
    </Card>
  )
}
