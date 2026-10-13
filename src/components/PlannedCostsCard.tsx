import { useState } from 'react'
import type { AppState, PlannedCost } from '../types'
import { Card } from './Card'
import { formatCurrency } from '../lib/finance'
import { daysUntil, formatShortDate, today } from '../lib/schedule'
import { fundsOf } from '../lib/recovery'
import {
  CAR_FUND,
  blockedBy,
  isOverdue,
  isPaid,
  payPlannedCost,
  plannedCostsOf,
  unpayPlannedCost,
} from '../lib/plannedCosts'

const muted = { color: 'var(--text-muted)' }
const inputStyle = { background: 'var(--surface-page)', borderColor: 'var(--border)', color: 'var(--text-primary)' }
const dollars = (n: number) => formatCurrency(n).replace('.00', '')
/** How long a paid cost stays on the card, so a mis-tap can still be undone. */
const KEEP_PAID_DAYS = 14

/**
 * One-off costs with a date — the car's inspection and registration. Shown
 * while any is unpaid, in date order, with what each is waiting on.
 */
export function PlannedCostsCard({
  state,
  setState,
  now = today(),
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
  now?: string
}) {
  const costs = plannedCostsOf(state)
  const shown = costs
    .filter((c) => !isPaid(c) || (c.paidOn && daysUntil(c.paidOn, now) > -KEEP_PAID_DAYS))
    .sort((a, b) => a.due.localeCompare(b.due))
  if (!shown.some((c) => !isPaid(c))) return null

  const unpaid = shown.filter((c) => !isPaid(c))
  const low = unpaid.reduce((n, c) => n + c.low, 0)
  const high = unpaid.reduce((n, c) => n + c.high, 0)
  const carFund = fundsOf(state).find((f) => f.id === CAR_FUND)

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Car costs coming up
        </h2>
        <span className="tabular-nums text-xs" style={muted}>
          {low === high ? dollars(high) : `${dollars(low)}–${dollars(high)}`} left
        </span>
      </div>
      <div className="mt-2 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
        {shown.map((c) => (
          <CostRow
            key={c.id}
            cost={c}
            waitingOn={blockedBy(costs, c)}
            now={now}
            carFund={carFund?.balance}
            onPay={(amount, from) => setState((s) => payPlannedCost(s, c.id, amount, from, now))}
            onUndo={() => setState((s) => unpayPlannedCost(s, c.id, now))}
          />
        ))}
      </div>
      <p className="mt-2 text-[11px]" style={muted}>
        Counted at the top of each range on the calendar and in the bank check until paid.
      </p>
    </Card>
  )
}

function CostRow({
  cost,
  waitingOn,
  now,
  carFund,
  onPay,
  onUndo,
}: {
  cost: PlannedCost
  waitingOn?: PlannedCost
  now: string
  carFund?: number
  onPay: (amount: number, from: 'checking' | 'car fund') => void
  onUndo: () => void
}) {
  const [paying, setPaying] = useState(false)
  const [amount, setAmount] = useState('')
  const [from, setFrom] = useState<'checking' | 'car fund'>('checking')
  const paid = isPaid(cost)
  const overdue = isOverdue(cost, now)
  const amt = Number(amount)
  const range = cost.low === cost.high ? dollars(cost.high) : `${dollars(cost.low)}–${dollars(cost.high)}`

  return (
    <div className="py-2 first:pt-0 last:pb-0" data-cost={cost.id}>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="min-w-0 text-sm font-medium"
          style={paid ? { color: 'var(--text-muted)', textDecoration: 'line-through' } : undefined}
        >
          {cost.name}
        </span>
        <span className="shrink-0 tabular-nums text-sm">
          {paid ? formatCurrency(cost.paidAmount ?? 0) : range}
        </span>
      </div>
      <p className="text-[11px]" style={{ color: !paid && overdue ? 'var(--status-critical)' : 'var(--text-muted)' }}>
        {paid
          ? `Paid ${formatShortDate(cost.paidOn ?? now)} from ${
              cost.paidFromFund && cost.paidFromFund < (cost.paidAmount ?? 0)
                ? 'the car fund and checking'
                : cost.paidFromFund
                  ? 'the car fund'
                  : 'checking'
            }`
          : [
              overdue ? `Overdue · due ${formatShortDate(cost.due)}` : `Due ${formatShortDate(cost.due)}`,
              cost.deadline && cost.deadline !== cost.due && `deadline ${formatShortDate(cost.deadline)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
      </p>
      {!paid && waitingOn && (
        <p className="text-[11px]" style={{ color: 'var(--status-warning)' }}>
          Waiting on: {waitingOn.name}.
        </p>
      )}
      {!paid && cost.notes && (
        <p className="text-[11px]" style={muted}>
          {cost.notes}
        </p>
      )}

      {paid ? (
        <button type="button" onClick={onUndo} className="mt-1 text-[11px] underline" style={muted}>
          Undo
        </button>
      ) : paying ? (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={amount}
              placeholder={cost.high.toFixed(2)}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border px-2 py-1.5 text-sm"
              style={inputStyle}
              aria-label={`What the ${cost.name} cost`}
            />
            <button
              type="button"
              disabled={!(amt > 0)}
              onClick={() => {
                onPay(amt, from)
                setPaying(false)
              }}
              className="shrink-0 rounded-lg px-3 text-xs font-medium disabled:opacity-40"
              style={{ background: 'var(--status-good)', color: 'white' }}
            >
              Save
            </button>
          </div>
          <div className="flex gap-2 text-xs">
            {(['checking', 'car fund'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={from === f}
                onClick={() => setFrom(f)}
                className="flex-1 rounded-lg border px-2 py-1"
                style={
                  from === f
                    ? { background: 'var(--cat-installment)', borderColor: 'var(--cat-installment)', color: 'white' }
                    : inputStyle
                }
              >
                {f === 'checking'
                  ? 'From PNC checking'
                  : `From the car fund${carFund !== undefined ? ` (${formatCurrency(carFund)})` : ''}`}
              </button>
            ))}
          </div>
          {from === 'car fund' && carFund !== undefined && amt > carFund && (
            <p className="text-[11px]" style={{ color: 'var(--status-warning)' }}>
              The car fund holds {formatCurrency(carFund)}, so the other {formatCurrency(amt - Math.max(carFund, 0))}{' '}
              comes out of checking.
            </p>
          )}
          <button type="button" onClick={() => setPaying(false)} className="self-start text-[11px] underline" style={muted}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setPaying(true)
            setAmount('')
          }}
          className="mt-1.5 rounded-lg px-2.5 py-1 text-xs font-medium"
          style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}
        >
          Mark paid
        </button>
      )}
    </div>
  )
}
