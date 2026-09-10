import { useState } from 'react'
import type { Shift } from '../types'
import { formatCurrency } from '../lib/finance'
import { MILEAGE_RATE, type ShiftInput } from '../lib/gig'
import { today } from '../lib/schedule'

const inputStyle = {
  background: 'var(--surface-page)',
  borderColor: 'var(--border)',
  color: 'var(--text-primary)',
}

const PLATFORMS = ['DoorDash', 'Uber Eats', 'Instacart', 'Grubhub', 'Amazon Flex', 'Other']

export function ShiftForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Shift
  onSave: (input: ShiftInput) => void
  onCancel: () => void
}) {
  const [date, setDate] = useState(initial?.date ?? today())
  const [platform, setPlatform] = useState(initial?.platform ?? PLATFORMS[0])
  const [earnings, setEarnings] = useState(initial ? String(initial.earnings) : '')
  const [gasCost, setGasCost] = useState(initial ? String(initial.gasCost) : '')
  const [hours, setHours] = useState(initial?.hours ? String(initial.hours) : '')
  const [miles, setMiles] = useState(initial?.miles ? String(initial.miles) : '')
  const [addedToBank, setAddedToBank] = useState(initial?.addedToBank ?? true)

  const gross = Number(earnings) || 0
  const gas = Number(gasCost) || 0
  const hrs = Number(hours) || 0
  const mi = Number(miles) || 0
  const net = gross - gas
  const perHour = hrs > 0 ? net / hrs : null

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (gross <= 0) return
        onSave({
          date,
          platform,
          earnings: gross,
          gasCost: gas,
          hours: hrs > 0 ? hrs : undefined,
          miles: mi > 0 ? mi : undefined,
          addedToBank,
        })
      }}
    >
      <div className="grid grid-cols-2 gap-3">
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
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Platform
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          >
            {(PLATFORMS.includes(platform) ? PLATFORMS : [platform, ...PLATFORMS]).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Earned ($)
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="0.00"
            value={earnings}
            onChange={(e) => setEarnings(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Gas ($)
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="0.00"
            value={gasCost}
            onChange={(e) => setGasCost(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Hours (optional)
          <input
            type="number"
            inputMode="decimal"
            step="0.25"
            placeholder="0"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Miles (optional)
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="0"
            value={miles}
            onChange={(e) => setMiles(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={addedToBank}
          onChange={(e) => setAddedToBank(e.target.checked)}
        />
        Add the net to my bank balance
      </label>

      {gross > 0 && (
        <div className="flex flex-col gap-1 rounded-lg p-2 text-xs" style={{ background: 'var(--surface-page)' }}>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>Net profit</span>
            <strong
              className="tabular-nums text-sm"
              style={{ color: net >= 0 ? 'var(--status-good)' : 'var(--status-critical)' }}
            >
              {formatCurrency(net)}
            </strong>
          </div>
          {perHour !== null && (
            <div className="flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
              <span>Per hour</span>
              <span className="tabular-nums">{formatCurrency(perHour)}/hr</span>
            </div>
          )}
          {mi > 0 && (
            <div className="flex items-center justify-between" style={{ color: 'var(--text-muted)' }}>
              <span>Mileage deduction at tax time</span>
              <span className="tabular-nums">{formatCurrency(mi * MILEAGE_RATE)}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-1 flex gap-2">
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
          disabled={gross <= 0}
          className="flex-1 rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          style={{ background: 'var(--status-good)', color: 'white' }}
        >
          {initial ? 'Save shift' : 'Log shift'}
        </button>
      </div>
    </form>
  )
}
