import { useState } from 'react'
import type { Shift, Vehicle } from '../types'
import { formatCurrency } from '../lib/finance'
import { MILEAGE_RATE, type ShiftInput } from '../lib/gig'
import { mpgFor, fuelFromRange } from '../lib/fuel'
import { today } from '../lib/schedule'

const inputStyle = {
  background: 'var(--surface-page)',
  borderColor: 'var(--border)',
  color: 'var(--text-primary)',
}

const PLATFORMS = ['DoorDash', 'Uber Eats', 'Instacart', 'Grubhub', 'Amazon Flex', 'Other']

export function ShiftForm({
  initial,
  vehicle,
  gasPrice,
  onSave,
  onCancel,
}: {
  initial?: Shift
  /** Needed to turn a range drop into gallons. Absent if no car is set up. */
  vehicle?: Vehicle
  /** Last price paid at the pump, for costing those gallons. */
  gasPrice?: number
  onSave: (input: ShiftInput) => void
  onCancel: () => void
}) {
  const [date, setDate] = useState(initial?.date ?? today())
  const [platform, setPlatform] = useState(initial?.platform ?? PLATFORMS[0])
  const [earnings, setEarnings] = useState(initial ? String(initial.earnings) : '')
  const [gasCost, setGasCost] = useState(initial ? String(initial.gasCost) : '')
  const [hours, setHours] = useState(initial?.hours ? String(initial.hours) : '')
  const [miles, setMiles] = useState(initial?.miles ? String(initial.miles) : '')
  const [rangeStart, setRangeStart] = useState(initial?.rangeStart ? String(initial.rangeStart) : '')
  const [rangeEnd, setRangeEnd] = useState(initial?.rangeEnd ? String(initial.rangeEnd) : '')
  const [atPump, setAtPump] = useState(initial?.rangeAtPump ? String(initial.rangeAtPump) : '')
  const [afterPump, setAfterPump] = useState(initial?.rangeAfterPump ? String(initial.rangeAfterPump) : '')
  const [addedToBank, setAddedToBank] = useState(initial?.addedToBank ?? true)

  const gross = Number(earnings) || 0
  const gas = Number(gasCost) || 0
  const hrs = Number(hours) || 0
  const before = Number(rangeStart) || 0
  const after = Number(rangeEnd) || 0

  // What the Gas ($) on this shift bought, so a mid-shift stop at the pump can
  // be accounted for rather than wrecking the reading.
  const gallonsAdded = gasPrice && gasPrice > 0 ? gas / gasPrice : 0

  // Both pump readings or neither: one alone cancels straight back out of the
  // arithmetic, so a half-filled pair would imply a precision it cannot deliver.
  const stop =
    atPump !== '' && afterPump !== ''
      ? { atPump: Number(atPump) || 0, afterPump: Number(afterPump) || 0 }
      : undefined

  // The range pair is only readable once both are in and the car is known.
  const used =
    vehicle && rangeStart !== '' && rangeEnd !== ''
      ? fuelFromRange(
          before,
          after,
          mpgFor(vehicle, vehicle.observedMpg ? 'observed' : 'combined'),
          gasPrice,
          gallonsAdded,
          stop,
        )
      : null

  // Typed miles win: the odometer is the real figure and the range only ever
  // stood in for it. Left blank, the range fills the gap.
  const mi = Number(miles) || (used && !used.unexplained ? Math.round(used.miles) : 0)
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
          ...(before > 0 ? { rangeStart: before } : {}),
          ...(rangeEnd !== '' ? { rangeEnd: after } : {}),
          ...(stop ? { rangeAtPump: stop.atPump, rangeAfterPump: stop.afterPump } : {}),
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
          Miles {used && !used.unexplained && miles === '' ? '(from range)' : '(optional)'}
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder={used && !used.unexplained ? String(Math.round(used.miles)) : '0'}
            value={miles}
            onChange={(e) => setMiles(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
      </div>

      {/*
        Two numbers off the dash, which is far less to capture than an odometer
        pair, and enough to price the shift on its own — no fill-up needed.
      */}
      {vehicle && (
        <div className="rounded-lg p-2" style={{ background: 'var(--surface-page)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Range on the dash
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Before
              <input
                type="number"
                inputMode="decimal"
                step="1"
                placeholder="miles"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              After
              <input
                type="number"
                inputMode="decimal"
                step="1"
                placeholder="miles"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
              />
            </label>
          </div>

          {/*
            Only useful as a pair, so they sit together and say so. Half a pair
            is worse than none: it reads like extra precision while the estimate
            quietly falls back on the pump price.
          */}
          <div className="mt-2">
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Stopped at the pump? Note the dash on both sides of the fill and the price stops
              mattering.
            </p>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Pulling in
                <input
                  type="number"
                  inputMode="decimal"
                  step="1"
                  placeholder="miles"
                  value={atPump}
                  onChange={(e) => setAtPump(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={inputStyle}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Pulling away
                <input
                  type="number"
                  inputMode="decimal"
                  step="1"
                  placeholder="miles"
                  value={afterPump}
                  onChange={(e) => setAfterPump(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={inputStyle}
                />
              </label>
            </div>
            {(atPump !== '') !== (afterPump !== '') && (
              <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Both, or neither — one on its own cancels out and changes nothing.
              </p>
            )}
          </div>

          {used?.unexplained && (
            <p className="mt-2 text-xs" style={{ color: 'var(--status-warning)' }}>
              {stop
                ? 'These four readings do not run in order. The pump ones sit between the start and the end, and the range only rises while fuel is going in.'
                : gasPrice && gasPrice > 0
                  ? gas > 0
                    ? `The range rose by more than ${formatCurrency(gas)} of fuel explains. Check the two readings and what you paid, or note the dash on both sides of the fill.`
                    : 'The range went up, so you filled up during the shift. Put what you paid in Gas ($), or note the dash on both sides of the fill.'
                  : 'The range went up, so you filled up during the shift. Note the dash on both sides of the fill, and no pump price is needed.'}
            </p>
          )}

          {used && !used.unexplained && used.rangeUsed > 0 && (
            <div className="mt-2 flex flex-col gap-1 text-xs">
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Used this shift</span>
                <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {Math.round(used.rangeUsed)} mi · {used.gallons.toFixed(1)} gal
                  {used.cost !== null && ` · ${formatCurrency(used.cost)}`}
                </span>
              </div>
              {used.cost === null && (
                <p style={{ color: 'var(--text-muted)' }}>
                  Price it by running the fill-up calculator once — the pump price it remembers
                  turns these gallons into dollars.
                </p>
              )}
              {used.refuelled && (
                <p style={{ color: 'var(--text-muted)' }}>
                  {used.measured
                    ? `Two legs added: ${Math.round(before - (stop?.atPump ?? 0))} miles before the pump and ${Math.round((stop?.afterPump ?? 0) - after)} after. The fill put back ${Math.round(used.rangeAdded)} miles, measured off the dash rather than worked out from the price.`
                    : `Counting the ${Math.round(used.rangeAdded)} miles of range the ${formatCurrency(gas)} of fuel put back — started on ${Math.round(before)}, ended on ${Math.round(after)}.`}
                </p>
              )}
              {/* The miles hold whatever the mpg; the gallons do not. Saying which
                  figure rests on the assumption is the difference between an
                  estimate and a guess. */}
              <p style={{ color: 'var(--text-muted)' }}>
                Miles come straight from the range drop. The gallons divide it by{' '}
                {used.mpg.toFixed(1)} MPG
                {vehicle.observedMpg ? ' — your observed average' : ', the EPA combined figure'}
                {!vehicle.observedMpg && ', so correct it from a real fill-up when you can'}.
              </p>
            </div>
          )}
        </div>
      )}

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
