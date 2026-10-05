import { useState } from 'react'
import type { Shift, Vehicle } from '../types'
import { formatCurrency } from '../lib/finance'
import { formatRate, mileageRate, type ShiftInput } from '../lib/gig'
import { mpgFor, fuelFromRange } from '../lib/fuel'
import { today } from '../lib/schedule'

const inputStyle = {
  background: 'var(--surface-page)',
  borderColor: 'var(--border)',
  color: 'var(--text-primary)',
}

const PLATFORMS = ['DoorDash', 'Uber Eats', 'Instacart', 'Grubhub', 'Amazon Flex', 'Instawork', 'Other']

export function ShiftForm({
  initial,
  vehicle,
  gasPrice,
  lastArea,
  onSave,
  onCancel,
}: {
  initial?: Shift
  /** Where the last shift was, so the log's "where" is one tap rather than typed each time. */
  lastArea?: string
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
  // An estimate is not put back in the box: it would read as typed, and saving
  // would promote it to measured. The range readings it came from are kept on
  // the shift, so the placeholder shows it again.
  const [miles, setMiles] = useState(
    initial?.miles && initial.milesFrom !== 'range' && initial.milesFrom !== 'odometer' ? String(initial.miles) : '',
  )
  const [rangeStart, setRangeStart] = useState(initial?.rangeStart ? String(initial.rangeStart) : '')
  const [rangeEnd, setRangeEnd] = useState(initial?.rangeEnd ? String(initial.rangeEnd) : '')
  const [atPump, setAtPump] = useState(initial?.rangeAtPump ? String(initial.rangeAtPump) : '')
  const [afterPump, setAfterPump] = useState(initial?.rangeAfterPump ? String(initial.rangeAfterPump) : '')
  const [addedToBank, setAddedToBank] = useState(initial?.addedToBank ?? true)
  const [odoStart, setOdoStart] = useState(initial?.odometerStart ? String(initial.odometerStart) : '')
  const [odoEnd, setOdoEnd] = useState(initial?.odometerEnd ? String(initial.odometerEnd) : '')
  const [paidAs, setPaidAs] = useState<'1099' | 'W-2'>(initial?.paidAs ?? '1099')
  const [area, setArea] = useState(initial?.area ?? lastArea ?? '')

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

  // The odometer pair wins outright: two readings anyone can check against the
  // car. Then typed miles, the trip meter. The range only ever stood in for
  // either, and fills the gap when both are blank.
  const odoA = Number(odoStart) || 0
  const odoB = Number(odoEnd) || 0
  const odoMiles = odoA > 0 && odoB > odoA ? Math.round((odoB - odoA) * 10) / 10 : 0
  const odoBackwards = odoA > 0 && odoB > 0 && odoB <= odoA
  const typed = Number(miles) || 0
  const fromRange = used && !used.unexplained ? Math.round(used.miles) : 0
  const mi = odoMiles || typed || fromRange
  // A shift from before the source was kept comes back with its miles in the
  // box, typed or not. Saved untouched and matching the range exactly, it was
  // the range's figure — call it that rather than promote it to measured.
  const legacyEstimate =
    !!initial && !initial.milesFrom && miles === String(initial.miles ?? '') && typed === fromRange
  const milesFrom =
    odoMiles > 0 ? 'odometer' : typed > 0 && !legacyEstimate ? 'measured' : mi > 0 ? 'range' : undefined
  const rate = mileageRate(date)
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
          ...(milesFrom ? { milesFrom } : {}),
          ...(before > 0 ? { rangeStart: before } : {}),
          ...(rangeEnd !== '' ? { rangeEnd: after } : {}),
          ...(stop ? { rangeAtPump: stop.atPump, rangeAfterPump: stop.afterPump } : {}),
          ...(odoA > 0 ? { odometerStart: odoA } : {}),
          ...(odoB > 0 ? { odometerEnd: odoB } : {}),
          ...(paidAs === 'W-2' ? { paidAs } : {}),
          ...(area.trim() ? { area: area.trim() } : {}),
          ...(initial?.notes ? { notes: initial.notes } : {}),
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

      {/*
        The question this answers: gas bought on a day off. It is not a cost of
        driving for work, and it needs no special handling either — a later
        dash starts with that fuel already in the tank, so the range drop over
        that dash never counts it.
      */}
      <p className="-mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Gas ($) is only what you pumped during this dash. Leave out fuel bought on a day you did
        not drive — the range readings already have it sitting in the tank.
      </p>

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
          Miles {fromRange > 0 && miles === '' ? '(estimated)' : '(trip meter)'}
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder={fromRange > 0 ? String(fromRange) : '0'}
            value={miles}
            onChange={(e) => setMiles(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
      </div>

      {/*
        GPS was the other way to get this, and a web app cannot do it: the
        phone stops giving it location the moment the Dasher app is in front,
        which is the whole dash. The car's own trip meter has no such gap.
      */}
      <p className="-mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {typed > 0 && !legacyEstimate
          ? 'Measured — this is the figure the mileage deduction uses.'
          : 'Reset Trip B on the dash when the dash starts, and type what it reads at the end. That is the exact distance, drives between orders included.'}
        {milesFrom === 'range' && ' Until then, the range readings below estimate it.'}
      </p>

      {/*
        The record the IRS trusts most, and the cheapest to take: two numbers
        off the dash, at the start and end. Optional, because the trip meter is
        already a good figure — but these are what settle a question about it.
      */}
      <div className="rounded-lg p-2" style={{ background: 'var(--surface-page)' }}>
        <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          For the mileage log (optional)
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Odometer at start
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="e.g. 184210"
              value={odoStart}
              onChange={(e) => setOdoStart(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Odometer at end
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="e.g. 184262"
              value={odoEnd}
              onChange={(e) => setOdoEnd(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
            />
          </label>
        </div>
        {odoMiles > 0 && (
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {odoMiles} miles by the odometer
            {typed > 0 && Math.abs(typed - odoMiles) >= 1 ? ` — used instead of the ${typed} typed above` : ''}.
          </p>
        )}
        {odoBackwards && (
          <p className="mt-1 text-[11px]" style={{ color: 'var(--status-warning)' }}>
            The end reading has to be higher than the start.
          </p>
        )}
        <label className="mt-2 flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Where
          <input
            type="text"
            placeholder="e.g. Raleigh area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
        <div className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Paid as
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(
              [
                ['1099', '1099 contractor'],
                ['W-2', 'W-2 employee'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={paidAs === value}
                onClick={() => setPaidAs(value)}
                className="rounded-lg border px-3 py-2 text-sm"
                style={
                  paidAs === value
                    ? { background: 'var(--cat-installment)', borderColor: 'var(--cat-installment)', color: 'white' }
                    : inputStyle
                }
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {paidAs === 'W-2'
              ? "Employees can't deduct driving for their job, so these miles stay out of the deduction."
              : platform === 'Instawork'
                ? 'Instawork says on each listing whether it pays W-2 or 1099 — check before you pick.'
                : 'DoorDash and the other delivery apps pay as 1099, so these miles are deductible.'}
          </p>
        </div>
      </div>

      {/*
        Two numbers off the dash, which is far less to capture than an odometer
        pair, and enough to price the shift on its own — no fill-up needed.
      */}
      {vehicle && (
        <div className="rounded-lg p-2" style={{ background: 'var(--surface-page)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Miles of range showing on the dash
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Start of dash
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
              End of dash
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
          <div className="mt-3">
            {/*
              "Pulling in" and "pulling away" read as cute rather than clear —
              nothing in either phrase says gas station. The heading carries
              the place, so the two labels only have to carry the moment.
            */}
            <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Only if you stopped for gas mid-dash
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Glance at the dash when you pull up to the pump and again before you drive off. With
              both, what you paid stops mattering.
            </p>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Before filling
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
                After filling
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
                Fill in both or neither — one on its own cancels out and changes nothing.
              </p>
            )}
          </div>

          {used?.unexplained && (
            <p className="mt-2 text-xs" style={{ color: 'var(--status-warning)' }}>
              {stop
                ? 'These four readings do not run in order. The two pump ones belong between the start and the end of the dash, and the range only climbs while fuel is going in.'
                : gasPrice && gasPrice > 0
                  ? gas > 0
                    ? `The range rose by more than ${formatCurrency(gas)} of fuel explains. Check the two readings and what you paid, or fill in the two pump readings above.`
                    : 'The range went up, so you stopped for gas during the dash. Put what you paid in Gas ($), or fill in the two pump readings above.'
                  : 'The range went up, so you stopped for gas during the dash. Fill in the two pump readings above and no pump price is needed.'}
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
                    ? `Two legs added: ${Math.round(before - (stop?.atPump ?? 0))} miles driving to the pump, ${Math.round((stop?.afterPump ?? 0) - after)} after it. The fill put back ${Math.round(used.rangeAdded)} miles, read off the dash rather than worked out from the price.`
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
              <span>
                {paidAs === 'W-2'
                  ? 'Mileage deduction — W-2, not deductible'
                  : `Mileage deduction at tax time · ${mi} mi × ${formatRate(rate)}`}
              </span>
              <span className="tabular-nums">{formatCurrency(paidAs === 'W-2' ? 0 : mi * rate)}</span>
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
