import { useState } from 'react'
import type { AppState, IncomeSource, PayFrequency, PaycheckInputs } from '../types'
import { Card } from './Card'
import { formatCurrency } from '../lib/finance'
import { DEFAULT_PAYCHECK, estimatePaycheck } from '../lib/paycheck'

const FEDEX_SOURCE_ID = 'income-fedex'

const inputStyle = {
  background: 'var(--surface-page)',
  borderColor: 'var(--border)',
  color: 'var(--text-primary)',
}

const FREQUENCIES: { value: PayFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
]

/** How each frequency reads after an amount: "$662.58 a week", never "a two weeks". */
const EVERY: Record<PayFrequency, string> = { weekly: 'a week', biweekly: 'every two weeks', monthly: 'a month' }

function Line({ label, amount, minus, strong }: { label: string; amount: number; minus?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span style={{ color: strong ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{label}</span>
      <span
        className={`tabular-nums ${strong ? 'font-semibold' : ''}`}
        style={{ color: minus ? 'var(--status-critical)' : 'var(--text-primary)' }}
      >
        {minus ? '−' : ''}
        {formatCurrency(amount)}
      </span>
    </div>
  )
}

export function PaycheckCard({
  state,
  setState,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}) {
  const saved = state.paycheck ?? DEFAULT_PAYCHECK
  // Kept as text so a field can be cleared while typing without snapping to 0.
  const [rate, setRate] = useState(saved.hourlyRate ? String(saved.hourlyRate) : '')
  const [hours, setHours] = useState(saved.hoursPerWeek ? String(saved.hoursPerWeek) : '')
  const [preTax, setPreTax] = useState(saved.preTaxPerCheck ? String(saved.preTaxPerCheck) : '')
  const [afterTax, setAfterTax] = useState(saved.afterTaxPerCheck ? String(saved.afterTaxPerCheck) : '')
  const [note, setNote] = useState<string | null>(null)

  const inputs: PaycheckInputs = {
    hourlyRate: Number(rate) || 0,
    hoursPerWeek: Number(hours) || 0,
    frequency: saved.frequency,
    preTaxPerCheck: Number(preTax) || 0,
    afterTaxPerCheck: Number(afterTax) || 0,
  }
  const est = estimatePaycheck(inputs)
  const every = EVERY[inputs.frequency]

  // Remembered as typed, so the estimate is still there next time.
  function remember(patch: Partial<PaycheckInputs>) {
    setState((s) => ({ ...s, paycheck: { ...inputs, ...patch } }))
  }

  const existing = state.incomeSources.find((s) => s.id === FEDEX_SOURCE_ID)
  const inSync =
    existing && Math.abs(existing.amount - est.net) < 0.005 && existing.frequency === inputs.frequency

  function saveAsIncome() {
    const source: IncomeSource = {
      id: FEDEX_SOURCE_ID,
      name: 'FedEx',
      amount: est.net,
      frequency: inputs.frequency,
      active: true,
      notes: `Estimated take-home: ${formatCurrency(inputs.hourlyRate)}/hr × ${inputs.hoursPerWeek}h a week, after federal, Social Security, Medicare and NC tax. Swap in the real figure from your first paystub.`,
    }
    setState((s) => ({
      ...s,
      incomeSources: s.incomeSources.some((x) => x.id === FEDEX_SOURCE_ID)
        ? s.incomeSources.map((x) => (x.id === FEDEX_SOURCE_ID ? source : x))
        : [...s.incomeSources, source],
    }))
    setNote(
      existing
        ? `FedEx income updated to ${formatCurrency(est.net)} ${every}.`
        : `Added FedEx at ${formatCurrency(est.net)} ${every}. Your runway and weekly plan now count it.`,
    )
  }

  const field = (label: string, value: string, set: (v: string) => void, key: keyof PaycheckInputs, step: string, placeholder: string) => (
    <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
      {label}
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step={step}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          set(e.target.value)
          remember({ [key]: Number(e.target.value) || 0 })
          setNote(null)
        }}
        className="rounded-lg border px-3 py-2 text-sm"
        style={inputStyle}
      />
    </label>
  )

  return (
    <Card>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
        FedEx paycheck estimate
      </h2>
      <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        What actually lands in the bank after tax. North Carolina, 2026 rates.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {field('Hourly pay ($)', rate, setRate, 'hourlyRate', '0.01', '0.00')}
        {field('Hours a week', hours, setHours, 'hoursPerWeek', '0.5', '0')}
      </div>

      <div className="mt-2 flex gap-1">
        {FREQUENCIES.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              remember({ frequency: f.value })
              setNote(null)
            }}
            className="flex-1 rounded-lg py-1.5 text-xs font-medium"
            style={{
              background: inputs.frequency === f.value ? 'var(--cat-installment)' : 'var(--surface-page)',
              color: inputs.frequency === f.value ? 'white' : 'var(--text-secondary)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {field('Health/dental per check', preTax, setPreTax, 'preTaxPerCheck', '0.01', '0.00')}
        {field('Other, after tax', afterTax, setAfterTax, 'afterTaxPerCheck', '0.01', '0.00')}
      </div>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Leave these at 0 until you know them. Insurance comes out before tax, so it costs you less
        than its price.
      </p>

      {est.gross > 0 && (
        <>
          <div className="mt-3 flex flex-col gap-1 rounded-lg p-2" style={{ background: 'var(--surface-page)' }}>
            <p className="text-[11px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
              Each paycheck · {{ weekly: 'weekly', biweekly: 'every two weeks', monthly: 'monthly' }[inputs.frequency]}
            </p>
            <Line label={`Regular, ${est.regularHours}h`} amount={est.regularPay} />
            {est.overtimePay > 0 && (
              <Line label={`Overtime, ${est.overtimeHours}h at time and a half`} amount={est.overtimePay} />
            )}
            <Line label="Gross" amount={est.gross} strong />
            {est.preTax > 0 && <Line label="Health/dental (before tax)" amount={est.preTax} minus />}
            <Line label="Federal income tax" amount={est.federal} minus />
            <Line label="Social Security (6.2%)" amount={est.socialSecurity} minus />
            <Line label="Medicare (1.45%)" amount={est.medicare} minus />
            <Line label="NC income tax (3.99%)" amount={est.state} minus />
            {est.afterTax > 0 && <Line label="Other (after tax)" amount={est.afterTax} minus />}
            <div className="mt-1 flex items-baseline justify-between border-t pt-1" style={{ borderColor: 'var(--border)' }}>
              <span className="text-sm font-semibold">Take-home</span>
              <strong className="tabular-nums text-lg" style={{ color: 'var(--status-good)' }}>
                {formatCurrency(est.net)}
              </strong>
            </div>
          </div>

          <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            About {formatCurrency(est.yearNet / 12)} a
            month · {formatCurrency(est.yearNet)} a year · {formatCurrency(est.netPerHour)} per hour worked ·{' '}
            {Math.round(est.takenOut * 100)}% taken out
          </p>

          {est.overtimeRefund > 0 && (
            // The one place the paycheck understates the job: withholding is taken
            // on overtime that the 2025 law then exempts.
            <p className="mt-1 text-xs" style={{ color: 'var(--status-good)' }}>
              Plus about {formatCurrency(est.overtimeRefund)} back at tax time for a year like this. The
              extra half of overtime pay is tax-free now, but payroll still withholds on it.
            </p>
          )}

          <button
            type="button"
            disabled={!!inSync}
            onClick={saveAsIncome}
            className="mt-3 w-full rounded-lg py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--status-good)', color: 'white' }}
          >
            {inSync
              ? 'Saved as your FedEx income'
              : existing
                ? `Update FedEx income to ${formatCurrency(est.net)} ${every}`
                : `Add as my FedEx income (${formatCurrency(est.net)} ${every})`}
          </button>
        </>
      )}

      {note && (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {note}
        </p>
      )}

      <p className="mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        An estimate: filing single, W-4 with nothing extra checked, the same hours every week. Your
        first real paystub beats it — check this against that one.
      </p>
    </Card>
  )
}
