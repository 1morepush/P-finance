import { useState } from 'react'
import type { AppState, PlanInputs } from '../types'
import { Card } from './Card'
import { formatCurrency } from '../lib/finance'
import { formatShortDate } from '../lib/schedule'
import { buildPlan, type PlanWindow } from '../lib/plan'

const inputStyle = {
  background: 'var(--surface-page)',
  borderColor: 'var(--border)',
  color: 'var(--text-primary)',
}

/** Bills listed before the rest fold into "+ N more". */
const BILLS_SHOWN = 6

function Row({ label, amount, tone }: { label: string; amount: number; tone?: 'good' | 'bad' | 'strong' }) {
  const color =
    tone === 'good' ? 'var(--status-good)' : tone === 'bad' ? 'var(--status-critical)' : 'var(--text-primary)'
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span style={{ color: tone ? color : 'var(--text-secondary)' }} className={tone ? 'font-semibold' : ''}>
        {label}
      </span>
      <span className={`tabular-nums ${tone ? 'font-semibold' : ''}`} style={{ color }}>
        {formatCurrency(amount)}
      </span>
    </div>
  )
}

const hoursText = (h: number) => (h < 1 ? `${Math.round(h * 60)} minutes` : `${Math.ceil(h * 2) / 2} hours`)

export function PaycheckPlanCard({
  state,
  setState,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}) {
  const [span, setSpan] = useState<PlanWindow>('week')
  const saved = state.plan ?? {}
  const [dashRateInput, setDashRateInput] = useState(saved.dashPerHour ? String(saved.dashPerHour) : '')
  const [price, setPrice] = useState(saved.depopPrice ? String(saved.depopPrice) : '')
  const [cost, setCost] = useState(saved.depopCost ? String(saved.depopCost) : '')

  const plan = buildPlan(state, span)
  const hasPay = !!state.paycheck && plan.income > 0

  function remember(patch: Partial<PlanInputs>) {
    setState((s) => ({ ...s, plan: { ...s.plan, ...patch } }))
  }

  const numberField = (
    label: string,
    value: string,
    set: (v: string) => void,
    key: keyof PlanInputs,
    placeholder: string,
  ) => (
    <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
      {label}
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          set(e.target.value)
          remember({ [key]: Number(e.target.value) || undefined })
        }}
        className="rounded-lg border px-3 py-2 text-sm"
        style={inputStyle}
      />
    </label>
  )

  const shown = plan.bills.slice(0, BILLS_SHOWN)
  const hidden = plan.bills.length - shown.length

  return (
    <Card>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
        Where the paycheck goes
      </h2>

      <div className="mt-2 flex gap-1">
        {(
          [
            ['week', 'This week'],
            ['fourWeeks', 'Next 4 weeks'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setSpan(value)}
            className="flex-1 rounded-lg py-1.5 text-xs font-medium"
            style={{
              background: span === value ? 'var(--cat-installment)' : 'var(--surface-page)',
              color: span === value ? 'white' : 'var(--text-secondary)',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {formatShortDate(plan.from)} – {formatShortDate(plan.to)}
      </p>

      <div className="mt-2 flex flex-col gap-1 rounded-lg p-2" style={{ background: 'var(--surface-page)' }}>
        <Row label={hasPay ? 'FedEx take-home' : 'FedEx take-home (enter your pay above)'} amount={plan.income} />
        {state.paycheck && state.paycheck.frequency !== 'weekly' && hasPay && (
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Your pay spread evenly by week — the app doesn't know which week payday falls in.
          </p>
        )}

        <p className="mt-2 text-[11px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
          1 · Bills due
        </p>
        {plan.bills.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            No debt payments due in these dates.
          </p>
        ) : (
          <>
            {shown.map((b) => (
              <div key={`${b.debtId}-${b.date}`} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate" style={{ color: 'var(--text-secondary)' }}>
                  {formatShortDate(b.date)} · {b.debtName}
                </span>
                <span className="tabular-nums shrink-0">{formatCurrency(b.amount)}</span>
              </div>
            ))}
            {hidden > 0 && (
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                + {hidden} more
              </p>
            )}
          </>
        )}

        <p className="mt-2 text-[11px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
          2 · Living costs
        </p>
        {plan.livingCostsMissing ? (
          // The need is debt-only until these exist, and says so rather than
          // quietly passing off an understated figure as the answer.
          <p className="text-xs" style={{ color: 'var(--status-warning)' }}>
            None entered — food, phone, car insurance and gas aren't counted, so what you need is
            higher than this shows. Add them under Living costs below.
          </p>
        ) : (
          <Row label="Food, phone, insurance and the rest" amount={plan.livingCosts} />
        )}

        <div className="mt-1 border-t pt-1" style={{ borderColor: 'var(--border)' }}>
          <Row label="To get through it" amount={plan.need} tone="strong" />
          {plan.shortfall > 0 ? (
            <Row label="Short" amount={plan.shortfall} tone="bad" />
          ) : (
            <Row label="Left over" amount={plan.leftover} tone="good" />
          )}
        </div>

        {plan.leftover > 0 && (
          <>
            <p className="mt-2 text-[11px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
              3 · What's left, by your Settings split
            </p>
            {plan.toSavings > 0 && <Row label="Savings" amount={plan.toSavings} />}
            {plan.toChecking > 0 && <Row label="Keep in checking" amount={plan.toChecking} />}
            {plan.toExtraDebt > 0 && (
              <Row
                label={`Extra toward ${plan.priorityDebt?.name ?? 'your top debt'}`}
                amount={plan.toExtraDebt}
              />
            )}
          </>
        )}
      </div>

      {/* Covering a gap — or, with none, what extra work would buy. */}
      <p className="mt-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
        {plan.shortfall > 0 ? `Covering the ${formatCurrency(plan.shortfall)}` : 'Extra income'}
      </p>

      <div className="mt-1 rounded-lg p-2" style={{ background: 'var(--surface-page)' }}>
        <p className="text-xs font-medium">DoorDash</p>
        {plan.dash ? (
          <>
            {plan.shortfall > 0 && plan.dashHours !== null && (
              <p className="text-sm font-semibold">≈ {hoursText(plan.dashHours)}</p>
            )}
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {formatCurrency(plan.dash.perHour)}/hr after gas
              {plan.dash.source === 'logged'
                ? ` across ${Math.round(plan.dash.hoursLogged * 10) / 10}h you've logged`
                : ', as you entered it'}
              , less about {formatCurrency(plan.dash.taxPerHour)}/hr to set aside for tax — DoorDash
              withholds none. Keeps {formatCurrency(plan.dash.keepPerHour)} an hour.
            </p>
            {plan.shortfall === 0 && plan.dash.keepPerHour > 0 && (
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                No shifts needed. Each extra hour puts about {formatCurrency(plan.dash.keepPerHour)} toward{' '}
                {plan.priorityDebt?.name ?? 'debt'}.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Log a shift with its hours and this uses your real rate. Until then, enter what you
              usually clear an hour after gas.
            </p>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {numberField('$/hr after gas', dashRateInput, setDashRateInput, 'dashPerHour', '0.00')}
            </div>
          </>
        )}
      </div>

      <div className="mt-2 rounded-lg p-2" style={{ background: 'var(--surface-page)' }}>
        <p className="text-xs font-medium">Depop</p>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {numberField('Typical sale ($)', price, setPrice, 'depopPrice', '0.00')}
          {numberField('What it cost you', cost, setCost, 'depopCost', '0 if yours')}
        </div>
        {plan.depopPerSale !== null && (
          <>
            {plan.shortfall > 0 && plan.depopSales !== null && (
              <p className="mt-1 text-sm font-semibold">
                ≈ {plan.depopSales} sale{plan.depopSales === 1 ? '' : 's'}
              </p>
            )}
            <p className="text-[11px]" style={{ color: plan.depopPerSale > 0 ? 'var(--text-muted)' : 'var(--status-critical)' }}>
              {plan.depopPerSale > 0
                ? `You keep ${formatCurrency(plan.depopPerSale)} a sale after Depop's 3.3% + 45¢ fee, with the buyer paying shipping.`
                : `That loses ${formatCurrency(-plan.depopPerSale)} a sale after Depop's fee.`}
            </p>
          </>
        )}
      </div>

      {plan.mix && (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Or half and half: {hoursText(plan.mix.hours)} of DoorDash and {plan.mix.sales} Depop sale
          {plan.mix.sales === 1 ? '' : 's'}.
        </p>
      )}
    </Card>
  )
}
