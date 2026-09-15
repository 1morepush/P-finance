import { useState } from 'react'
import type { AppState, Expense, IncomeSource, Shift } from '../types'
import { Card } from '../components/Card'
import { Modal } from '../components/Modal'
import { IncomeForm } from '../components/IncomeForm'
import { ShiftForm } from '../components/ShiftForm'
import { ExpenseForm } from '../components/ExpenseForm'
import { formatCurrency, formatDate } from '../lib/finance'
import {
  addExpense,
  CADENCE_LABEL,
  expenseMonthly,
  monthlyExpenses,
  removeExpense,
  updateExpense,
  type ExpenseInput,
} from '../lib/budget'
import {
  addShift,
  last7Days,
  recentShifts,
  removeShift,
  shiftNet,
  shiftsInMonth,
  summarize,
  updateShift,
  type ShiftInput,
} from '../lib/gig'
import { formatMonth, formatShortDate, today } from '../lib/schedule'
import { uid } from '../lib/id'

export function Income({
  state,
  setState,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}) {
  const [editing, setEditing] = useState<IncomeSource | 'new' | null>(null)
  const [shiftModal, setShiftModal] = useState<Shift | 'new' | null>(null)
  const [expenseModal, setExpenseModal] = useState<Expense | 'new' | null>(null)
  const [allShifts, setAllShifts] = useState(false)
  /** The shift whose Delete has been armed, so it takes a second tap. */
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

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
      return { ...s, incomeSources: [...s.incomeSources, { ...form, id: uid() }] }
    })
    setEditing(null)
  }

  function remove(id: string) {
    setState((s) => ({ ...s, incomeSources: s.incomeSources.filter((src) => src.id !== id) }))
    setEditing(null)
  }

  /** Opening or closing the shift editor always disarms a pending delete. */
  function showShift(target: Shift | 'new' | null) {
    setShiftModal(target)
    setConfirmDelete(null)
  }

  function saveShift(input: ShiftInput) {
    setState((s) =>
      shiftModal && shiftModal !== 'new' ? updateShift(s, shiftModal.id, input) : addShift(s, input),
    )
    showShift(null)
  }

  function deleteShift(id: string) {
    setState((s) => removeShift(s, id))
    showShift(null)
  }

  function saveExpense(input: ExpenseInput) {
    setState((s) =>
      expenseModal && expenseModal !== 'new'
        ? updateExpense(s, expenseModal.id, input)
        : addExpense(s, input),
    )
    setExpenseModal(null)
  }

  function deleteExpense(id: string) {
    setState((s) => removeExpense(s, id))
    setExpenseModal(null)
  }

  const recentEntries = [...state.incomeEntries].reverse().slice(0, 10)

  const month = today().slice(0, 7)
  const thisMonth = summarize(shiftsInMonth(state.shifts, month))
  const week = summarize(last7Days(state.shifts))
  const allTime = summarize(state.shifts)
  // Capping the log at ten made anything older permanently uneditable, since
  // opening a shift is the only way to change it.
  const SHIFT_PREVIEW = 10
  const shiftLog = recentShifts(state.shifts, allShifts ? state.shifts.length : SHIFT_PREVIEW)
  const hiddenShifts = state.shifts.length - shiftLog.length
  const expenseTotal = monthlyExpenses(state)
  const expenses = [...state.expenses].sort((a, b) => expenseMonthly(b) - expenseMonthly(a))

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
                {src.endsOn && (
                  <div className="text-xs font-medium" style={{ color: 'var(--status-warning)' }}>
                    ends {formatDate(src.endsOn)}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Living costs
        </h2>
        <button
          type="button"
          onClick={() => setExpenseModal('new')}
          className="rounded-lg px-3 py-1.5 text-sm font-medium"
          style={{ background: 'var(--cat-installment)', color: 'white' }}
        >
          + Add expense
        </button>
      </div>

      <Card>
        {expenses.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Nothing entered yet. Rent, groceries, phone, insurance — until these are here the app
            treats every dollar after debt minimums as spare, which it is not.
          </p>
        ) : (
          <>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Total each month
              </span>
              <span className="tabular-nums text-xl font-semibold">
                {formatCurrency(expenseTotal)}
              </span>
            </div>
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
              {expenses.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setExpenseModal(e)}
                  className="flex items-center justify-between gap-2 py-2 text-left text-sm first:pt-0 last:pb-0"
                >
                  <span className="min-w-0">
                    <span className="truncate font-medium">{e.name}</span>
                    {!e.essential && (
                      <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        optional
                      </span>
                    )}
                    <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatCurrency(e.amount)} {CADENCE_LABEL[e.cadence]}
                    </span>
                  </span>
                  <span className="tabular-nums shrink-0">
                    {formatCurrency(expenseMonthly(e))}
                    <span style={{ color: 'var(--text-muted)' }}>/mo</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </Card>

      <div className="mt-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Gig work
        </h2>
        <button
          type="button"
          onClick={() => showShift('new')}
          className="rounded-lg px-3 py-1.5 text-sm font-medium"
          style={{ background: 'var(--status-good)', color: 'white' }}
        >
          + Log shift
        </button>
      </div>

      <Card>
        {allTime.count === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Log a DoorDash or delivery shift with what you earned and what you spent on gas, and
            you'll see the net profit — plus what it actually worked out to per hour.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {formatMonth(month)} net profit
              </div>
              <div
                className="tabular-nums text-2xl font-semibold"
                style={{ color: thisMonth.net >= 0 ? 'var(--status-good)' : 'var(--status-critical)' }}
              >
                {formatCurrency(thisMonth.net)}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {formatCurrency(thisMonth.gross)} earned − {formatCurrency(thisMonth.gas)} gas ·{' '}
                {thisMonth.count} {thisMonth.count === 1 ? 'shift' : 'shifts'}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <Stat
                label="Per hour"
                value={thisMonth.netPerHour === null ? '—' : `${formatCurrency(thisMonth.netPerHour)}/hr`}
              />
              <Stat
                label="Gas share"
                value={thisMonth.gross > 0 ? `${Math.round(thisMonth.gasShare * 100)}%` : '—'}
              />
              <Stat label="Last 7 days" value={formatCurrency(week.net)} />
            </div>

            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              All time: {formatCurrency(allTime.net)} net across {allTime.count}{' '}
              {allTime.count === 1 ? 'shift' : 'shifts'}
              {allTime.miles > 0 && (
                <> · {allTime.miles.toLocaleString()} mi logged, worth {formatCurrency(allTime.mileageDeduction)} as a mileage deduction at tax time</>
              )}
            </div>
          </div>
        )}
      </Card>

      {shiftLog.length > 0 && (
        <Card>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Shift log
            </h3>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Tap a shift to edit it
            </span>
          </div>
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {shiftLog.map((shift) => (
              // The whole row opens the editor. It used to share the row with a
              // Delete button, which both hid the edit and put an irreversible
              // action under the thumb aiming for it — deleting now lives inside
              // the editor, behind the tap that opens it.
              <button
                key={shift.id}
                type="button"
                onClick={() => showShift(shift)}
                className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm first:pt-0 last:pb-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{shift.platform}</span>
                  <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatShortDate(shift.date)} · {formatCurrency(shift.earnings)} −{' '}
                    {formatCurrency(shift.gasCost)} gas
                    {shift.hours ? ` · ${shift.hours}h` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className="tabular-nums font-semibold"
                    style={{ color: shiftNet(shift) >= 0 ? 'var(--status-good)' : 'var(--status-critical)' }}
                  >
                    {formatCurrency(shiftNet(shift))}
                  </span>
                  <span
                    aria-hidden
                    className="text-xs leading-none"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    ›
                  </span>
                </span>
              </button>
            ))}
          </div>

          {(hiddenShifts > 0 || allShifts) && (
            <button
              type="button"
              onClick={() => setAllShifts((v) => !v)}
              className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium"
              style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}
            >
              {allShifts
                ? `Show the last ${SHIFT_PREVIEW}`
                : `Show all ${state.shifts.length} shifts`}
            </button>
          )}
        </Card>
      )}

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

      {shiftModal && (
        <Modal
          title={shiftModal === 'new' ? 'Log a shift' : 'Edit shift'}
          onClose={() => showShift(null)}
        >
          <ShiftForm
            initial={shiftModal === 'new' ? undefined : shiftModal}
            onSave={saveShift}
            onCancel={() => showShift(null)}
          />
          {/* Deleting a shift cannot be undone — unlike a payment, there is no
              record left to restore it from — so it asks once. */}
          {shiftModal !== 'new' && (
            <button
              type="button"
              onClick={() =>
                confirmDelete === shiftModal.id
                  ? deleteShift(shiftModal.id)
                  : setConfirmDelete(shiftModal.id)
              }
              className="mt-3 w-full rounded-lg py-2 text-sm font-medium"
              style={{
                background:
                  confirmDelete === shiftModal.id ? 'var(--status-critical)' : 'transparent',
                color: confirmDelete === shiftModal.id ? 'white' : 'var(--status-critical)',
              }}
            >
              {confirmDelete !== shiftModal.id
                ? 'Delete shift'
                : shiftModal.addedToBank
                  ? `Delete for good — ${formatCurrency(shiftNet(shiftModal))} comes back off the bank`
                  : 'Delete for good'}
            </button>
          )}
        </Modal>
      )}

      {expenseModal && (
        <Modal
          title={expenseModal === 'new' ? 'Add a living cost' : 'Edit living cost'}
          onClose={() => setExpenseModal(null)}
        >
          <ExpenseForm
            initial={expenseModal === 'new' ? undefined : expenseModal}
            onSave={saveExpense}
            onCancel={() => setExpenseModal(null)}
          />
          {expenseModal !== 'new' && (
            <button
              type="button"
              onClick={() => deleteExpense(expenseModal.id)}
              className="mt-3 w-full rounded-lg py-2 text-sm font-medium"
              style={{ background: 'transparent', color: 'var(--status-critical)' }}
            >
              Delete
            </button>
          )}
        </Modal>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="tabular-nums text-sm font-semibold">{value}</div>
    </div>
  )
}
