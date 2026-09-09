import { useState } from 'react'
import type { AppState, IncomeSource } from '../types'
import { Card } from '../components/Card'
import { Modal } from '../components/Modal'
import { IncomeForm } from '../components/IncomeForm'
import { ShiftForm } from '../components/ShiftForm'
import { formatCurrency, formatDate } from '../lib/finance'
import {
  addShift,
  last7Days,
  recentShifts,
  removeShift,
  shiftNet,
  shiftsInMonth,
  summarize,
  type ShiftInput,
} from '../lib/gig'
import { formatMonth, formatShortDate, today } from '../lib/schedule'

export function Income({
  state,
  setState,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}) {
  const [editing, setEditing] = useState<IncomeSource | 'new' | null>(null)
  const [loggingShift, setLoggingShift] = useState(false)

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

  function logShift(input: ShiftInput) {
    setState((s) => addShift(s, input))
    setLoggingShift(false)
  }

  function deleteShift(id: string) {
    setState((s) => removeShift(s, id))
  }

  const recentEntries = [...state.incomeEntries].reverse().slice(0, 10)

  const month = today().slice(0, 7)
  const thisMonth = summarize(shiftsInMonth(state.shifts, month))
  const week = summarize(last7Days(state.shifts))
  const allTime = summarize(state.shifts)
  const shiftLog = recentShifts(state.shifts)

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

      <div className="mt-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Gig work
        </h2>
        <button
          type="button"
          onClick={() => setLoggingShift(true)}
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
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {shiftLog.map((shift) => (
              <div
                key={shift.id}
                className="flex items-center justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{shift.platform}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatShortDate(shift.date)} · {formatCurrency(shift.earnings)} −{' '}
                    {formatCurrency(shift.gasCost)} gas
                    {shift.hours ? ` · ${shift.hours}h` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="tabular-nums font-semibold"
                    style={{ color: shiftNet(shift) >= 0 ? 'var(--status-good)' : 'var(--status-critical)' }}
                  >
                    {formatCurrency(shiftNet(shift))}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteShift(shift.id)}
                    className="rounded-lg px-2 py-1 text-xs"
                    style={{ background: 'var(--surface-page)', color: 'var(--text-muted)' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
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

      {loggingShift && (
        <Modal title="Log a shift" onClose={() => setLoggingShift(false)}>
          <ShiftForm onSave={logShift} onCancel={() => setLoggingShift(false)} />
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
