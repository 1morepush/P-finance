import { useState, type ReactNode } from 'react'
import type { AppState } from '../types'
import { Card } from './Card'
import { formatCurrency, formatDate } from '../lib/finance'
import { formatShortDate } from '../lib/schedule'
import { floorStatus } from '../lib/recovery'
import { addPending, cancelPending, markPosted, pendingOf, pendingTotal, setBankFromStatement, statementBalance } from '../lib/pending'

const inputStyle = { background: 'var(--surface-page)', borderColor: 'var(--border)', color: 'var(--text-primary)' }
const muted = { color: 'var(--text-muted)' }
const chip = { background: 'var(--surface-page)', color: 'var(--text-secondary)' }

/**
 * The balance, and the one-tap ways to bring it up to date. Shows what is
 * really there; when something sent has not left PNC yet, it also says what
 * PNC itself will be showing, so the two can be checked against each other.
 */
export function BankCard({
  state,
  setState,
  actions,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
  /** Extra buttons beside Update — the screenshot reader, Stripe. */
  actions?: ReactNode
}) {
  const [mode, setMode] = useState<'none' | 'balance' | 'sent'>('none')
  const [input, setInput] = useState('')
  const [label, setLabel] = useState('')
  const pending = pendingOf(state)
  const waiting = pendingTotal(state)
  const floor = floorStatus(state)
  const bank = state.bankBalance.amount

  function save() {
    const amount = Number(input)
    if (input === '' || Number.isNaN(amount)) return
    setState((s) => (mode === 'sent' ? addPending(s, label || 'Payment', amount) : setBankFromStatement(s, amount)))
    setMode('none')
    setInput('')
    setLabel('')
  }

  return (
    <Card>
      <div className="flex items-end justify-between gap-3" data-find="bank">
        <div className="min-w-0">
          <div className="text-xs" style={muted}>
            In the bank
          </div>
          <div
            className="tabular-nums text-3xl font-semibold"
            style={{ color: bank < 0 ? 'var(--status-critical)' : 'var(--text-primary)' }}
          >
            {formatCurrency(bank)}
          </div>
        </div>
        {state.savingsBalance > 0 && (
          <div className="text-right">
            <div className="text-xs" style={muted}>
              Savings
            </div>
            <div className="tabular-nums text-sm font-semibold" style={{ color: 'var(--status-good)' }}>
              {formatCurrency(state.savingsBalance)}
            </div>
          </div>
        )}
      </div>
      <p className="mt-1 text-xs" style={{ color: floor.reached ? 'var(--status-good)' : 'var(--status-warning)' }}>
        {floor.reached
          ? `✓ Above your ${formatCurrency(floor.target).replace('.00', '')} floor`
          : `${formatCurrency(floor.toGo)} under the ${formatCurrency(floor.step!).replace('.00', '')} step of your ${formatCurrency(floor.target).replace('.00', '')} floor`}
        <span style={muted}> · updated {formatDate(state.bankBalance.updatedAt)}</span>
      </p>

      {pending.length > 0 && (
        <div className="mt-3 rounded-lg p-2" style={{ background: 'var(--surface-page)' }} data-pending>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span style={{ color: 'var(--text-secondary)' }}>
              PNC still shows <strong className="tabular-nums">{formatCurrency(statementBalance(state))}</strong>
            </span>
            <span className="tabular-nums" style={muted}>
              {formatCurrency(waiting)} not out yet
            </span>
          </div>
          <div className="mt-1 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {pending.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                <span className="min-w-0">
                  <span className="block truncate">{o.label}</span>
                  <span style={muted}>
                    sent {formatShortDate(o.date)} · {formatCurrency(o.amount)}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setState((s) => markPosted(s, o.id))}
                    className="rounded-md px-2 py-1 font-medium"
                    style={{ background: 'var(--status-good)', color: 'white' }}
                  >
                    It's out
                  </button>
                  <button
                    type="button"
                    onClick={() => setState((s) => cancelPending(s, o.id))}
                    className="rounded-md px-2 py-1"
                    style={chip}
                    aria-label={`${o.label} never went out`}
                  >
                    Didn't go
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg px-3 py-1.5 text-xs font-medium"
          style={mode === 'balance' ? { background: 'var(--cat-installment)', color: 'white' } : chip}
          onClick={() => {
            setMode(mode === 'balance' ? 'none' : 'balance')
            setInput('')
          }}
        >
          Update balance
        </button>
        {actions}
        <button
          type="button"
          className="rounded-lg px-3 py-1.5 text-xs font-medium"
          style={mode === 'sent' ? { background: 'var(--cat-installment)', color: 'white' } : chip}
          onClick={() => {
            setMode(mode === 'sent' ? 'none' : 'sent')
            setInput('')
          }}
        >
          Sent, not out yet
        </button>
      </div>

      {mode !== 'none' && (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          {mode === 'sent' && (
            <input
              type="text"
              placeholder="What was it? e.g. Venmo to Liv"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
              aria-label="What was sent"
            />
          )}
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              autoFocus
              placeholder={mode === 'sent' ? 'Amount sent' : 'What PNC shows now'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
              aria-label={mode === 'sent' ? 'Amount sent' : 'What PNC shows now'}
            />
            <button
              type="submit"
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: 'var(--cat-installment)', color: 'white' }}
            >
              Save
            </button>
          </div>
          <p className="text-[11px]" style={muted}>
            {mode === 'sent'
              ? "For money you've sent that PNC hasn't taken yet. It comes off your balance here now, and you tap \"It's out\" when PNC catches up."
              : waiting > 0
                ? `Type the available balance PNC shows. The ${formatCurrency(waiting)} not out yet is taken off for you.`
                : 'Type the available balance PNC shows.'}
          </p>
        </form>
      )}
    </Card>
  )
}
