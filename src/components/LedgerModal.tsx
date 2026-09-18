import { useState } from 'react'
import type { Debt, LedgerEntry } from '../types'
import type { AppState } from '../types'
import { Modal } from './Modal'
import { formatCurrency } from '../lib/finance'
import { formatShortDate, today } from '../lib/schedule'
import {
  addLedgerEntry,
  ledgerTotals,
  removeLedgerEntry,
  updateLedgerEntry,
  withRunningTotal,
  type LedgerInput,
} from '../lib/ledger'

const inputStyle = {
  background: 'var(--surface-card)',
  borderColor: 'var(--border)',
  color: 'var(--text-primary)',
}

/**
 * The running tab with one person, line by line.
 *
 * A total on its own answers "how much" and nothing else — not what it was
 * for, not when, not which part has been paid back. Each line carries its own
 * note, and the balance is their sum, so the two can never disagree.
 */
export function LedgerModal({
  debt,
  setState,
  onClose,
}: {
  /** Read live from state by the caller, so the list redraws as lines are added. */
  debt: Debt
  setState: React.Dispatch<React.SetStateAction<AppState>>
  onClose: () => void
}) {
  const entries = debt.ledger ?? []
  const totals = ledgerTotals(entries)
  const rows = withRunningTotal(entries)

  const [adding, setAdding] = useState<'charge' | 'payment' | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const [fromBank, setFromBank] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editNote, setEditNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const value = Number(amount) || 0

  function reset() {
    setAdding(null)
    setAmount('')
    setNote('')
    setDate(today())
    setFromBank(true)
  }

  function save() {
    if (value <= 0 || !adding) return
    const input: LedgerInput = {
      date,
      // A payment is the same thing seen from the other side, so it goes in
      // negative rather than into a separate list.
      amount: adding === 'payment' ? -value : value,
      ...(note.trim() ? { note: note.trim() } : {}),
      // Only money leaving the account moves the bank. Something added to the
      // tab is a debt taken on, not a withdrawal.
      ...(adding === 'payment' && fromBank ? { fromBank: true } : {}),
    }
    setState((s) => addLedgerEntry(s, debt.id, input))
    reset()
  }

  function saveNote(entry: LedgerEntry) {
    setState((s) =>
      updateLedgerEntry(s, debt.id, entry.id, {
        date: entry.date,
        amount: entry.amount,
        ...(editNote.trim() ? { note: editNote.trim() } : {}),
        ...(entry.fromBank ? { fromBank: true } : {}),
      }),
    )
    setEditing(null)
  }

  return (
    <Modal title={debt.name} onClose={onClose}>
      <div className="rounded-lg p-3" style={{ background: 'var(--surface-page)' }}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">Owed right now</span>
          <span
            className="tabular-nums text-2xl font-semibold"
            style={{ color: totals.balance > 0 ? 'var(--cat-personal)' : 'var(--status-good)' }}
          >
            {formatCurrency(totals.balance)}
          </span>
        </div>
        <div
          className="mt-1 flex items-baseline justify-between gap-3 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          <span>
            {formatCurrency(totals.charges)} added across {totals.count} line
            {totals.count === 1 ? '' : 's'}
          </span>
          <span>{formatCurrency(totals.payments)} paid back</span>
        </div>
      </div>

      {/* Oldest first, each with the total as it stood after it — how a tab reads. */}
      <div className="mt-3 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
        {rows.map(({ entry, running }) => {
          const paid = entry.amount < 0
          return (
            <div key={entry.id} className="py-2 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(editing === entry.id ? null : entry.id)
                    setEditNote(entry.note ?? '')
                    setConfirmDelete(null)
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate">
                    {entry.note || (
                      <span style={{ color: 'var(--text-muted)' }}>
                        {paid ? 'Payment' : 'No note yet — tap to add one'}
                      </span>
                    )}
                  </span>
                  <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {formatShortDate(entry.date)}
                    {entry.fromBank && ' · from the bank'}
                    {' · '}
                    {formatCurrency(running)} after
                  </span>
                </button>
                <span
                  className="tabular-nums shrink-0 font-medium"
                  style={{ color: paid ? 'var(--status-good)' : 'var(--text-primary)' }}
                >
                  {paid ? '−' : '+'}
                  {formatCurrency(Math.abs(entry.amount))}
                </span>
              </div>

              {editing === entry.id && (
                <div className="mt-2 flex flex-col gap-2 rounded-lg p-2" style={{ background: 'var(--surface-page)' }}>
                  <input
                    autoFocus
                    value={editNote}
                    placeholder="What was this for?"
                    onChange={(e) => setEditNote(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={inputStyle}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveNote(entry)}
                      className="flex-1 rounded-lg py-1.5 text-xs font-medium"
                      style={{ background: 'var(--cat-installment)', color: 'white' }}
                    >
                      Save note
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        confirmDelete === entry.id
                          ? (setState((s) => removeLedgerEntry(s, debt.id, entry.id)),
                            setEditing(null),
                            setConfirmDelete(null))
                          : setConfirmDelete(entry.id)
                      }
                      className="flex-1 rounded-lg py-1.5 text-xs font-medium"
                      style={{
                        background:
                          confirmDelete === entry.id ? 'var(--status-critical)' : 'var(--surface-card)',
                        color: confirmDelete === entry.id ? 'white' : 'var(--status-critical)',
                      }}
                    >
                      {confirmDelete === entry.id
                        ? `Delete — tab goes to ${formatCurrency(totals.balance - entry.amount)}`
                        : 'Delete line'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {entries.length === 0 && (
          <p className="py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Nothing on this tab yet.
          </p>
        )}
      </div>

      {adding ? (
        <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--surface-page)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {adding === 'charge' ? `Something new you owe ${debt.name}` : `Paying ${debt.name} back`}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Amount ($)
              <input
                autoFocus
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
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
          <label className="mt-2 flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            What for
            <input
              value={note}
              placeholder={adding === 'charge' ? 'Dinner, gas, concert ticket' : 'Venmo, cash'}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
            />
          </label>
          {adding === 'payment' && (
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fromBank}
                onChange={(e) => setFromBank(e.target.checked)}
              />
              Take it off my bank balance
            </label>
          )}
          {value > 0 && (
            <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Tab goes {formatCurrency(totals.balance)} →{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(
                  Math.round((totals.balance + (adding === 'payment' ? -value : value)) * 100) / 100,
                )}
              </strong>
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="flex-1 rounded-lg py-2 text-xs font-medium"
              style={{ background: 'var(--surface-card)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={value <= 0}
              onClick={save}
              className="flex-1 rounded-lg py-2 text-xs font-medium disabled:opacity-40"
              style={{
                background: adding === 'payment' ? 'var(--status-good)' : 'var(--cat-personal)',
                color: 'white',
              }}
            >
              {adding === 'charge' ? 'Add to the tab' : 'Record the payment'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setAdding('charge')}
            className="flex-1 rounded-lg py-2 text-sm font-medium"
            style={{ background: 'var(--cat-personal)', color: 'white' }}
          >
            + Add to the tab
          </button>
          <button
            type="button"
            onClick={() => setAdding('payment')}
            className="flex-1 rounded-lg py-2 text-sm font-medium"
            style={{ background: 'var(--status-good)', color: 'white' }}
          >
            − Record a payment
          </button>
        </div>
      )}
    </Modal>
  )
}
