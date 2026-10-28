import { useState } from 'react'
import type { Debt } from '../types'
import { formatCurrency } from '../lib/finance'
import { earlyPayoff } from '../lib/payoff'
import type { PaymentInput } from '../lib/payments'
import { today } from '../lib/schedule'

const inputStyle = { background: 'var(--surface-page)', borderColor: 'var(--border)', color: 'var(--text-primary)' }
const muted = { color: 'var(--text-muted)' }

/**
 * Marks a debt fully paid off in one go. The amount starts at what settling
 * today would cost — for an instalment loan with interest still to accrue,
 * that is less than the balance — and can be changed to the lender's own
 * payoff quote. Whatever it comes to, the debt clears; the part not paid is
 * recorded so undoing restores the whole balance.
 */
export function PaidOffForm({
  debt,
  onSave,
  onCancel,
}: {
  debt: Debt
  onSave: (input: PaymentInput) => void
  onCancel: () => void
}) {
  const quote = Math.round(earlyPayoff(debt).today * 100) / 100
  const [amount, setAmount] = useState(quote.toFixed(2))
  const [date, setDate] = useState(today())
  const [fromBank, setFromBank] = useState(true)
  const amt = Number(amount)
  const valid = amt >= 0 && amt <= debt.balance + 0.005 && amount !== ''
  const writtenOff = valid ? Math.max(debt.balance - amt, 0) : 0

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSave({ debtId: debt.id, amount: amt, date, fromBank, advanceDue: false, settle: true })
      }}
    >
      <p className="text-sm">
        <span className="font-medium">{debt.name}</span> has{' '}
        <span className="tabular-nums">{formatCurrency(debt.balance)}</span> left. Marking it paid off
        clears it and moves it to the paid-off list.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Amount paid ($)
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
      </div>
      {quote < debt.balance - 0.005 && (
        <p className="-mt-1 text-[11px]" style={muted}>
          Paying it off today should cost about {formatCurrency(quote)}, since interest not yet charged
          drops away. Use the lender's payoff quote if it differs.
        </p>
      )}
      {writtenOff >= 0.01 && (
        <p className="-mt-1 text-[11px]" style={muted}>
          The other {formatCurrency(writtenOff)} is cleared without being paid — a payoff discount or
          dropped interest. Undo puts the full {formatCurrency(debt.balance)} back.
        </p>
      )}
      {amount !== '' && amt > debt.balance + 0.005 && (
        <p className="-mt-1 text-[11px]" style={{ color: 'var(--status-warning)' }}>
          That's more than the {formatCurrency(debt.balance)} left. Log the extra separately if it was a
          fee.
        </p>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={fromBank} onChange={(e) => setFromBank(e.target.checked)} />
        It came out of PNC checking
      </label>
      {!fromBank && (
        <p className="-mt-2 text-[11px]" style={muted}>
          The bank balance stays as it is — paid from another account, or forgiven.
        </p>
      )}

      <div className="flex gap-2">
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
          disabled={!valid}
          className="flex-1 rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          style={{ background: 'var(--status-good)', color: 'white' }}
        >
          Mark paid off
        </button>
      </div>
    </form>
  )
}
