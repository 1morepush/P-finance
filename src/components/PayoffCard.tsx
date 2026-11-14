import { useState } from 'react'
import type { AppState } from '../types'
import { Card } from './Card'
import { formatCurrency } from '../lib/finance'
import { formatMonth, today } from '../lib/schedule'
import { applyPayment } from '../lib/payments'
import { payoffPlan } from '../lib/safe'
import { LUMP } from '../data/recoveryPlan'

const inputStyle = { background: 'var(--surface-page)', borderColor: 'var(--border)', color: 'var(--text-primary)' }
const muted = { color: 'var(--text-muted)' }
const secondary = { color: 'var(--text-secondary)' }
const dollars = (n: number) => formatCurrency(n).replace(/\.00$/, '')

/**
 * The plan for the one debt still charging interest: this month's target and
 * how far along it is, what can go on it today without touching the floor,
 * and when it ends — at the minimum, at the target, and with the lump sum.
 */
export function PayoffCard({
  state,
  setState,
  now = today(),
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
  now?: string
}) {
  const plan = payoffPlan(state, now, LUMP)
  const [paying, setPaying] = useState(false)
  const [amount, setAmount] = useState('')
  const [notPosted, setNotPosted] = useState(true)
  if (!plan) return null
  const { debt } = plan
  const pct = Math.min(plan.paidThisMonth / plan.monthly, 1) * 100
  const amt = Number(amount)
  const done = (p: { doneBy: string | null }) => (p.doneBy ? formatMonth(p.doneBy) : 'never at this rate')

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2" data-find="payoff">
        <h2 className="text-sm font-semibold" style={secondary}>
          {debt.name} payoff
        </h2>
        <span className="tabular-nums text-sm font-semibold">{formatCurrency(debt.balance)}</span>
      </div>
      <p className="text-[11px]" style={muted}>
        {debt.apr}% APR · about {formatCurrency(plan.interestPerMonth)} of interest a month
      </p>

      <div className="mt-3 flex items-baseline justify-between gap-2 text-xs">
        <span style={secondary}>
          {formatMonth(now.slice(0, 7))}: {dollars(plan.paidThisMonth)} of {dollars(plan.monthly)}
        </span>
        <span className="tabular-nums" style={{ color: plan.toGo > 0 ? 'var(--text-secondary)' : 'var(--status-good)' }}>
          {plan.toGo > 0 ? `${dollars(plan.toGo)} to go` : '✓ done for the month'}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-page)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--status-good)' }} />
      </div>

      {plan.toGo > 0 && (
        <p className="mt-2 text-xs" style={{ color: plan.payNow > 0 ? 'var(--text-primary)' : 'var(--status-warning)' }} data-pay-now={plan.payNow}>
          {plan.payNow >= plan.toGo
            ? `You can pay the ${dollars(plan.toGo)} today and stay above your floor and bills.`
            : plan.payNow > 0
              ? `You can safely pay ${dollars(plan.payNow)} today. The other ${dollars(plan.toGo - plan.payNow)} waits for the next paycheck.`
              : `Nothing spare today. Pay at least the ${dollars(debt.monthlyPayment ?? plan.monthly)} minimum by its due date, from your next paycheck.`}
        </p>
      )}

      {!paying ? (
        <button
          type="button"
          onClick={() => {
            setAmount(plan.payNow > 0 ? String(plan.payNow) : '')
            setPaying(true)
          }}
          className="mt-2 rounded-lg px-3 py-1.5 text-xs font-medium"
          style={{ background: 'var(--status-good)', color: 'white' }}
        >
          I paid the {debt.name}
        </button>
      ) : (
        <form
          className="mt-2 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!(amt > 0)) return
            setState((s) =>
              applyPayment(s, { debtId: debt.id, amount: amt, date: now, fromBank: true, advanceDue: true, notPosted }),
            )
            setPaying(false)
          }}
        >
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              autoFocus
              placeholder="Amount paid"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
              aria-label={`Amount paid to ${debt.name}`}
            />
            <button type="submit" disabled={!(amt > 0)} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40" style={{ background: 'var(--status-good)', color: 'white' }}>
              Save
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs" style={secondary}>
            <input type="checkbox" checked={notPosted} onChange={(e) => setNotPosted(e.target.checked)} />
            PNC hasn't taken it out yet
          </label>
          <button type="button" onClick={() => setPaying(false)} className="self-start text-[11px] underline" style={muted}>
            Cancel
          </button>
        </form>
      )}

      <div className="mt-3 flex flex-col gap-1 border-t pt-2 text-xs" style={{ borderColor: 'var(--border)' }}>
        <div className="flex justify-between gap-2" style={muted}>
          <span>Minimum only ({dollars(debt.monthlyPayment ?? plan.monthly)}/mo)</span>
          <span className="tabular-nums">
            {done(plan.atMinimum)} · {dollars(plan.atMinimum.interest)} interest
          </span>
        </div>
        <div className="flex justify-between gap-2" style={plan.withLump ? muted : undefined}>
          <span>{dollars(plan.monthly)} a month</span>
          <span className="tabular-nums">
            {done(plan.atTarget)} · {dollars(plan.atTarget.interest)} interest
          </span>
        </div>
        {plan.withLump && plan.lump && (
          <div className="flex justify-between gap-2 font-medium" data-with-lump={plan.withLump.doneBy}>
            <span>
              {dollars(plan.monthly)} a month + the {dollars(plan.lump.amount)}
            </span>
            <span className="tabular-nums" style={{ color: 'var(--status-good)' }}>
              {done(plan.withLump)} · {dollars(plan.withLump.interest)} interest
            </span>
          </div>
        )}
      </div>
      {plan.lump && (
        <p className="mt-1 text-[11px]" style={muted}>
          Counts the {plan.lump.name} arriving in {formatMonth(plan.lump.month)}. That date is a guess until
          it is paid, so don't spend it early.
        </p>
      )}
    </Card>
  )
}
