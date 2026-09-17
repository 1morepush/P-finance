import { useState } from 'react'
import type { AppState, Vehicle } from '../types'
import { Card } from './Card'
import { formatCurrency } from '../lib/finance'
import { combinedMpg, estimateFill, impliedMpg, mpgFor, type DrivingMix } from '../lib/fuel'

const inputStyle = {
  background: 'var(--surface-page)',
  borderColor: 'var(--border)',
  color: 'var(--text-primary)',
}

const DEFAULT_VEHICLE: Vehicle = {
  name: 'My car',
  cityMpg: 18,
  highwayMpg: 26,
  tankGallons: 18.5,
  reserveGallons: 2,
}

/**
 * What is left in the tank, and what filling it costs.
 *
 * Read the range off the dash, type it in with the pump price, and the
 * arithmetic that used to happen in your head at the pump happens here — with
 * the reserve counted, which is the part that is easy to get wrong by about
 * six dollars.
 */
export function FuelCard({
  state,
  setState,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}) {
  const vehicle = state.vehicle ?? DEFAULT_VEHICLE
  const [range, setRange] = useState('')
  const [price, setPrice] = useState(state.lastGasPrice ? String(state.lastGasPrice) : '')
  const [mix, setMix] = useState<DrivingMix>(vehicle.observedMpg ? 'observed' : 'combined')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(vehicle)

  const rangeValue = Number(range)
  const priceValue = Number(price) || 0
  const hasRange = range.trim() !== '' && Number.isFinite(rangeValue) && rangeValue >= 0

  const mpg = mpgFor(vehicle, mix)
  const fill = estimateFill(vehicle, hasRange ? rangeValue : 0, priceValue, mpg)

  const options: { key: DrivingMix; label: string; mpg: number }[] = [
    { key: 'city', label: 'City', mpg: vehicle.cityMpg },
    { key: 'combined', label: 'Mixed', mpg: combinedMpg(vehicle) },
    { key: 'highway', label: 'Hwy', mpg: vehicle.highwayMpg },
    ...(vehicle.observedMpg && vehicle.observedMpg > 0
      ? [{ key: 'observed' as DrivingMix, label: 'Actual', mpg: vehicle.observedMpg }]
      : []),
  ]

  /** Keeps the price so it is not retyped, since it moves slowly. */
  function rememberPrice() {
    const p = Number(price)
    if (p > 0 && p !== state.lastGasPrice) setState((s) => ({ ...s, lastGasPrice: p }))
  }

  function saveVehicle() {
    const clean: Vehicle = {
      ...form,
      name: form.name.trim() || 'My car',
      cityMpg: Math.max(form.cityMpg, 1),
      highwayMpg: Math.max(form.highwayMpg, 1),
      tankGallons: Math.max(form.tankGallons, 1),
      reserveGallons: Math.max(form.reserveGallons, 0),
      ...(form.observedMpg && form.observedMpg > 0 ? { observedMpg: form.observedMpg } : {}),
    }
    if (!form.observedMpg || form.observedMpg <= 0) delete clean.observedMpg
    setState((s) => ({ ...s, vehicle: clean }))
    if (!clean.observedMpg && mix === 'observed') setMix('combined')
    setEditing(false)
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Gas
        </h2>
        <button
          type="button"
          onClick={() => {
            setForm(vehicle)
            setEditing((v) => !v)
          }}
          className="text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {editing ? 'Done' : vehicle.name}
        </button>
      </div>

      {editing ? (
        <div className="mt-2 rounded-lg p-2" style={{ background: 'var(--surface-page)' }}>
          <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Car
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ ...inputStyle, background: 'var(--surface-card)' }}
            />
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                ['cityMpg', 'City MPG', '1'],
                ['highwayMpg', 'Highway MPG', '1'],
                ['tankGallons', 'Tank (gal)', '0.1'],
                ['reserveGallons', 'Reserve below 0 (gal)', '0.1'],
              ] as const
            ).map(([key, label, step]) => (
              <label key={key} className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {label}
                <input
                  type="number"
                  inputMode="decimal"
                  step={step}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ ...inputStyle, background: 'var(--surface-card)' }}
                />
              </label>
            ))}
          </div>
          <label className="mt-2 flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Your actual MPG (optional)
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="from the trip computer"
              value={form.observedMpg ?? ''}
              onChange={(e) =>
                setForm({ ...form, observedMpg: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ ...inputStyle, background: 'var(--surface-card)' }}
            />
            <span style={{ color: 'var(--text-muted)' }}>
              A sixteen-year-old car doing stop-and-go delivery work rarely matches the sticker.
              Whatever the dash's lifetime average says beats every figure above it.
            </span>
          </label>
          <button
            type="button"
            onClick={saveVehicle}
            className="mt-2 w-full rounded-lg py-2 text-xs font-medium"
            style={{ background: 'var(--cat-installment)', color: 'white' }}
          >
            Save
          </button>
        </div>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Range on the dash (mi)
              <input
                type="number"
                inputMode="numeric"
                placeholder="120"
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Price per gallon ($)
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="3.09"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                onBlur={rememberPrice}
                className="rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
              />
            </label>
          </div>

          {/* The range display is the car's own recent average times the fuel it
              senses, so dividing it back out only works if the two agree. */}
          <div className="mt-2 flex gap-1">
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setMix(o.key)}
                className="flex flex-1 flex-col items-center rounded-lg py-1"
                style={{
                  background: mix === o.key ? 'var(--cat-installment)' : 'var(--surface-page)',
                  color: mix === o.key ? 'white' : 'var(--text-secondary)',
                }}
              >
                <span className="text-xs font-medium">{o.label}</span>
                <span className="tabular-nums text-[10px]">{o.mpg.toFixed(1)}</span>
              </button>
            ))}
          </div>

          {hasRange && priceValue > 0 ? (
            <>
              <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--surface-page)' }}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">Cost to fill up</span>
                  <span
                    className="tabular-nums text-2xl font-semibold"
                    style={{ color: 'var(--status-good)' }}
                  >
                    {formatCurrency(fill.costToFill)}
                  </span>
                </div>
                <div
                  className="mt-1 flex items-baseline justify-between gap-3 text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span>Gas left in the tank</span>
                  <span className="tabular-nums">
                    {fill.gallonsInTank.toFixed(1)} gal · {formatCurrency(fill.gallonsInTank * priceValue)}
                  </span>
                </div>
                <div
                  className="mt-0.5 flex items-baseline justify-between gap-3 text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span>The pump takes</span>
                  <span className="tabular-nums">{fill.gallonsToFill.toFixed(1)} gal</span>
                </div>
                <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {fill.gallonsShown.toFixed(1)} gal the range is counting, plus about{' '}
                  {fill.reserve.toFixed(1)} still in when the display reads zero.
                </p>
              </div>

              {fill.impossible && (
                <p className="mt-2 text-xs" style={{ color: 'var(--status-warning)' }}>
                  ⚠ {rangeValue} miles at {fill.mpg.toFixed(1)} MPG would need more fuel than the
                  tank holds, so the car is doing better than that. At a full tank this range implies
                  about {impliedMpg(vehicle, rangeValue).toFixed(1)} MPG — worth setting as your
                  actual figure.
                </p>
              )}

              <div
                className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[11px]"
                style={{ color: 'var(--text-muted)' }}
              >
                <span>
                  Full tank: {fill.fullTankMiles.toFixed(0)} mi ·{' '}
                  {formatCurrency(fill.fullTankCost)}
                </span>
                <span className="tabular-nums">
                  {(fill.costPerMile * 100).toFixed(1)}¢ per mile
                </span>
              </div>
              <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                A 40-mile delivery run burns about{' '}
                {formatCurrency(fill.costPerMile * 40)} of that — worth knowing before you
                accept an order.
              </p>
            </>
          ) : (
            <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              Put in the range your dash is showing and what the pump is charging, and this works
              out what is left and what a fill-up costs. At {mpg.toFixed(1)} MPG a full{' '}
              {vehicle.tankGallons} gallons goes about{' '}
              {(vehicle.tankGallons * mpg).toFixed(0)} miles.
            </p>
          )}
        </>
      )}
    </Card>
  )
}
