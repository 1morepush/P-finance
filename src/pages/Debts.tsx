import { useState } from 'react'
import type { AppState, Debt, PriorityTier } from '../types'
import { categoryOf, PRODUCT_CADENCE, PRODUCT_LABEL, TIER_LABEL } from '../types'
import { Card } from '../components/Card'
import { Modal } from '../components/Modal'
import { DebtForm } from '../components/DebtForm'
import { PaymentForm } from '../components/PaymentForm'
import { applyPayment, isOrphaned, undoPayment, type PaymentInput } from '../lib/payments'
import { earlyPayoff, payoffSummary } from '../lib/payoff'
import { WhatIfCard } from '../components/WhatIfCard'
import { byLender } from '../lib/lender'
import { LedgerModal } from '../components/LedgerModal'
import { ensureLedger, ledgerMismatches, ledgerTotals, tabs } from '../lib/ledger'
import { formatShortDate, isDate, today } from '../lib/schedule'
import { uid } from '../lib/id'
import {
  activeDebts,
  formatCurrency,
  formatDate,
  formatDue,
  orderByStrategy,
  potentialDebts,
  totalCleared,
} from '../lib/finance'

/** How many logged payments the list shows before it has to be expanded. */
const PAYMENTS_PREVIEW = 15

const CATEGORY_COLOR = {
  installment: 'var(--cat-installment)',
  revolving: 'var(--cat-revolving)',
  personal: 'var(--cat-personal)',
} as const

const TIER_COLOR: Record<PriorityTier, string> = {
  0: 'var(--status-critical)',
  1: 'var(--status-serious)',
  2: 'var(--status-warning)',
  3: 'var(--cat-revolving)',
  4: 'var(--cat-personal)',
}

function DebtCard({
  debt,
  badge,
  onClick,
  onPay,
  onOpenTab,
}: {
  debt: Debt
  badge?: string
  onClick: () => void
  onPay?: () => void
  /** Personal debts kept line by line open their tab rather than the editor. */
  onOpenTab?: () => void
}) {
  const payoff = earlyPayoff(debt)
  return (
    <Card className="cursor-pointer">
      <div onClick={onClick}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {badge && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: 'var(--status-good)', color: 'white' }}
                >
                  {badge}
                </span>
              )}
              {debt.status === 'potential' && (
                <span
                  className="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ borderColor: 'var(--status-warning)', color: 'var(--status-warning)' }}
                >
                  UNCONFIRMED
                </span>
              )}
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: CATEGORY_COLOR[categoryOf(debt)] }}
              />
              <span className="font-medium">{debt.name}</span>
            </div>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              {PRODUCT_LABEL[debt.product]}
              {debt.notes ? ` · ${debt.notes}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="tabular-nums font-semibold">{formatCurrency(debt.balance)}</span>
            {onPay && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onPay()
                }}
                className="rounded-md px-2 py-0.5 text-[11px] font-medium"
                style={{ background: 'var(--status-good)', color: 'white' }}
              >
                Pay
              </button>
            )}
          </div>
        </div>
        <div
          className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          {debt.apr > 0 && <span>{debt.apr}% APR</span>}
          {debt.monthlyPayment && <span>{formatCurrency(debt.monthlyPayment)}/mo</span>}
          {debt.nextDue && <span>next {formatDue(debt.nextDue)}</span>}
          {debt.finalPaymentDate && <span>ends {formatDate(debt.finalPaymentDate)}</span>}
        </div>
        {/* An agreed deferral is worth more than the date it moved: it is the
            thing to quote if the lender's system forgets. */}
        {debt.deferrals && debt.deferrals.length > 0 && (
          <p className="mt-1 text-xs" style={{ color: 'var(--status-warning)' }}>
            Deferred {formatShortDate(debt.deferrals.at(-1)!.from)} →{' '}
            {formatShortDate(debt.deferrals.at(-1)!.to)}
            {debt.deferrals.at(-1)!.note && (
              <span style={{ color: 'var(--text-muted)' }}> · {debt.deferrals.at(-1)!.note}</span>
            )}
          </p>
        )}
        {payoff.saved >= 0.01 && (
          <p className="mt-1 text-xs">
            <span style={{ color: 'var(--text-muted)' }}>Settle today </span>
            <span className="tabular-nums">{formatCurrency(payoff.today)}</span>
            <span style={{ color: 'var(--status-good)' }}>
              {' '}· saves {formatCurrency(payoff.saved)}
            </span>
          </p>
        )}
      </div>

      {/* A tab is worth opening far more often than the debt's settings are. */}
      {onOpenTab && debt.ledger && (
        <button
          type="button"
          onClick={onOpenTab}
          className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs"
          style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}
        >
          <span>
            {debt.ledger.length} line{debt.ledger.length === 1 ? '' : 's'}
            {ledgerTotals(debt.ledger).payments > 0 && (
              <span style={{ color: 'var(--text-muted)' }}>
                {' '}· {formatCurrency(ledgerTotals(debt.ledger).payments)} paid back
              </span>
            )}
          </span>
          <span style={{ color: 'var(--cat-personal)' }}>Open the tab ›</span>
        </button>
      )}
    </Card>
  )
}

export function Debts({
  state,
  setState,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}) {
  const [editing, setEditing] = useState<Debt | 'new' | null>(null)
  const [paying, setPaying] = useState<string | 'any' | null>(null)
  /** The debt whose Delete has been armed, so it takes a second tap. */
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [allPayments, setAllPayments] = useState(false)
  const [openTab, setOpenTab] = useState<string | null>(null)
  const [deferring, setDeferring] = useState(false)
  const [deferTo, setDeferTo] = useState('')
  const [deferNote, setDeferNote] = useState('')

  function logPayment(input: PaymentInput) {
    setState((s) => applyPayment(s, input))
    setPaying(null)
  }

  /** Opening or closing the editor always disarms a pending delete and deferral. */
  function edit(target: Debt | 'new' | null) {
    setEditing(target)
    setConfirmDelete(null)
    setDeferring(false)
    setDeferTo(target && target !== 'new' && isDate(target.nextDue) ? target.nextDue : '')
    setDeferNote('')
  }

  function logDeferral(debt: Debt) {
    if (!isDate(deferTo) || !isDate(debt.nextDue)) return
    const from = debt.nextDue
    const to = deferTo
    setState((s) => ({
      ...s,
      debts: s.debts.map((d) =>
        d.id === debt.id
          ? {
              ...d,
              nextDue: to,
              deferrals: [
                ...(d.deferrals ?? []),
                { date: today(), from, to, ...(deferNote.trim() ? { note: deferNote.trim() } : {}) },
              ],
            }
          : d,
      ),
    }))
    edit(null)
  }

  // A scheduled payment with no date to fall on is in the total and nowhere
  // else — not on the calendar, not in any window, never settled.
  const undated = activeDebts(state.debts).filter(
    (d) => PRODUCT_CADENCE[d.product] && d.monthlyPayment && !isDate(d.nextDue),
  )
  const lenders = byLender(state.debts, today())
  const paymentsOwedBy = (id: string) => state.payments.filter((p) => p.debtId === id).length
  const people = tabs(state.debts)
  const peopleTotal = people.reduce((s, d) => s + d.balance, 0)
  // Nothing in the app should be able to put a tab out of step with its own
  // lines; this is here so that if something ever does, it is visible.
  const drifted = ledgerMismatches(state.debts)
  const tabDebt = openTab ? state.debts.find((d) => d.id === openTab) : null

  const payoff = payoffSummary(state.debts)
  // The what-if only means anything for revolving credit; a fixed plan's balance
  // already contains its charge, so paying it faster costs no less.
  const revolving = activeDebts(state.debts).find(
    (d) => d.product === 'credit_card' && d.apr > 0 && d.monthlyPayment,
  )
  const ordered = orderByStrategy(state.debts, state.settings.strategy)
  const potential = potentialDebts(state.debts)
  const byTier = state.settings.strategy === 'tier'

  const tiers = ([0, 1, 2, 3, 4] as PriorityTier[])
    .map((t) => ({ tier: t, debts: ordered.filter((d) => d.priorityTier === t) }))
    .filter((g) => g.debts.length > 0)

  function save(form: Omit<Debt, 'id'>) {
    setState((s) => {
      if (editing && editing !== 'new') {
        return {
          ...s,
          debts: s.debts.map((d) => (d.id === editing.id ? { ...form, id: editing.id } : d)),
        }
      }
      return { ...s, debts: [...s.debts, { ...form, id: uid() }] }
    })
    setEditing(null)
  }

  function remove(id: string) {
    setState((s) => ({ ...s, debts: s.debts.filter((d) => d.id !== id) }))
    edit(null)
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Debts</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPaying('any')}
            className="rounded-lg px-3 py-1.5 text-sm font-medium"
            style={{ background: 'var(--status-good)', color: 'white' }}
          >
            Log payment
          </button>
          <button
            type="button"
            onClick={() => edit('new')}
            className="rounded-lg px-3 py-1.5 text-sm font-medium"
            style={{ background: 'var(--cat-installment)', color: 'white' }}
          >
            + Add
          </button>
        </div>
      </div>

      {undated.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--status-warning)' }}>
            Needs a due date
          </h2>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {undated.length === 1 ? 'This plan has' : 'These plans have'} a monthly payment but no
            date for it to fall on, so {undated.length === 1 ? 'it is' : 'they are'} in the total and
            nowhere else — not on the calendar, not in any window, never settled. Tap to set one.
          </p>
          <div className="mt-2 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {undated.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => edit(d)}
                className="flex items-center justify-between gap-2 py-1.5 text-left text-sm first:pt-0 last:pb-0"
              >
                <span className="min-w-0 truncate">{d.name}</span>
                <span className="tabular-nums shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {formatCurrency(d.monthlyPayment!)}/mo · {formatCurrency(d.balance)}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {drifted.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--status-critical)' }}>
            A tab disagrees with its own lines
          </h2>
          {drifted.map(({ debt, balance, fromLedger }) => (
            <p key={debt.id} className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {debt.name} shows {formatCurrency(balance)} but its lines sum to{' '}
              {formatCurrency(fromLedger)}. Open the tab and add or correct a line — the lines are
              what the balance means.
            </p>
          ))}
        </Card>
      )}

      {/* What is owed to people, which is the part with names attached. */}
      {people.length > 0 && (
        <Card>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Owed to people
            </h2>
            <span className="tabular-nums text-sm font-semibold" style={{ color: 'var(--cat-personal)' }}>
              {formatCurrency(peopleTotal)}
            </span>
          </div>
          <div className="mt-2 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {people.map((d) => {
              const t = ledgerTotals(d.ledger ?? [])
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    // A tab with no lines yet gets one for the balance it
                    // already carries, before the sheet can add to it.
                    setState((s) => ensureLedger(s, d.id))
                    setOpenTab(d.id)
                  }}
                  className="flex items-center justify-between gap-2 py-2 text-left text-sm first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{d.name}</span>
                    <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {t.count === 0 ? (
                        'No lines yet — tap to itemise it'
                      ) : (
                        <>
                          {t.count} line{t.count === 1 ? '' : 's'}
                          {t.payments > 0 && ` · ${formatCurrency(t.payments)} paid back`}
                        </>
                      )}
                    </span>
                  </span>
                  <span className="tabular-nums shrink-0 font-semibold">
                    {formatCurrency(d.balance)}
                  </span>
                  <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                    ›
                  </span>
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {/* Who the money is owed to, for the call that asks for time. Five
          Affirm plans are one account and one phone number. */}
      {lenders.length > 1 && (
        <Card>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            By lender
          </h2>
          <div className="mt-2 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {lenders.map((l) => (
              <div key={l.lender} className="py-2 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">
                    {l.lender}
                    <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      · {l.debts.length} {l.debts.length === 1 ? 'plan' : 'plans'}
                      {l.apr > 0 && ` · up to ${l.apr}%`}
                    </span>
                  </span>
                  <span className="tabular-nums shrink-0 text-sm font-semibold">
                    {formatCurrency(l.total)}
                  </span>
                </div>
                <div
                  className="mt-0.5 flex items-baseline justify-between gap-3 text-[11px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span>
                    {l.next
                      ? `next ${formatCurrency(l.next.amount)} on ${formatShortDate(l.next.date)}`
                      : 'nothing scheduled'}
                  </span>
                  <span className="tabular-nums">{formatCurrency(l.next30)} in 30 days</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {byTier
          ? 'Grouped by priority tier. Change the strategy in Settings.'
          : state.settings.strategy === 'avalanche'
            ? 'Ordered by highest APR first (avalanche). Change this in Settings.'
            : 'Ordered by smallest balance first (snowball). Change this in Settings.'}
      </p>

      <Card>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Clear everything today
        </h2>
        <div className="mt-2 flex flex-col gap-1 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span style={{ color: 'var(--text-secondary)' }}>If the schedules run their course</span>
            <span className="tabular-nums">{formatCurrency(payoff.scheduled)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span style={{ color: 'var(--text-secondary)' }}>Settled in full today</span>
            <span className="tabular-nums">{formatCurrency(payoff.today)}</span>
          </div>
          <div
            className="mt-1 flex items-baseline justify-between gap-3 border-t pt-2"
            style={{ borderColor: 'var(--border)' }}
          >
            <span className="font-semibold">You would save</span>
            <span className="tabular-nums font-semibold" style={{ color: 'var(--status-good)' }}>
              {formatCurrency(payoff.saved)}
            </span>
          </div>
        </div>
        {payoff.worthwhile.length > 0 && (
          <div className="mt-3 rounded-lg p-2" style={{ background: 'var(--surface-page)' }}>
            <p className="mb-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Where the saving actually is — everything else is 0% and saves nothing:
            </p>
            {payoff.worthwhile.map(({ debt, payoff: pay }) => (
              <div key={debt.id} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 truncate">{debt.name}</span>
                <span className="tabular-nums shrink-0" style={{ color: 'var(--status-good)' }}>
                  {formatCurrency(pay.saved)}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Instalment plans assume the lender waives interest you have not yet been charged, which is
          the usual arrangement — confirm a payoff quote before settling. The Apple Card figure is
          simply the interest never accrued.
        </p>
      </Card>

      {revolving && <WhatIfCard debt={revolving} />}

      {byTier ? (
        tiers.map(({ tier, debts }) => (
          <section key={tier} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                style={{ background: TIER_COLOR[tier], color: '#0d0d0d' }}
              >
                TIER {tier}
              </span>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {TIER_LABEL[tier]}
              </h2>
              <span className="tabular-nums ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
                {formatCurrency(debts.reduce((s, d) => s + d.balance, 0))}
              </span>
            </div>
            {debts.map((d, i) => (
              <DebtCard
                key={d.id}
                debt={d}
                badge={tier === tiers[0].tier && i === 0 ? 'NEXT TARGET' : undefined}
                onClick={() => edit(d)}
                onPay={() => setPaying(d.id)}
                onOpenTab={d.ledger ? () => setOpenTab(d.id) : undefined}
              />
            ))}
          </section>
        ))
      ) : (
        <div className="flex flex-col gap-3">
          {ordered.map((d, i) => (
            <DebtCard
              key={d.id}
              debt={d}
              badge={i === 0 ? 'NEXT TARGET' : undefined}
              onClick={() => edit(d)}
              onPay={() => setPaying(d.id)}
              onOpenTab={d.ledger ? () => setOpenTab(d.id) : undefined}
            />
          ))}
        </div>
      )}

      {potential.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Unconfirmed — not counted in totals
          </h2>
          {potential.map((d) => (
            <DebtCard key={d.id} debt={d} onClick={() => edit(d)} />
          ))}
        </section>
      )}

      {state.clearedDebts.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="mt-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Cleared 🎉
            </h2>
            <span
              className="tabular-nums ml-auto text-xs font-semibold"
              style={{ color: 'var(--status-good)' }}
            >
              {formatCurrency(totalCleared(state.clearedDebts))} paid off
            </span>
          </div>
          <Card>
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
              {[...state.clearedDebts]
                .sort((a, b) => b.dateCleared.localeCompare(a.dateCleared))
                .map((c) => (
                  <div key={c.id} className="py-2 text-sm first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate">{c.name}</span>
                      <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatDate(c.dateCleared)}
                      </span>
                      <span
                        className="tabular-nums shrink-0 font-medium"
                        style={{ color: 'var(--status-good)' }}
                      >
                        {formatCurrency(c.amountCleared)}
                      </span>
                    </div>
                    {c.notes && (
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {c.notes}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </Card>
        </section>
      )}

      {state.payments.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Logged payments
          </h2>
          <Card>
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
              {[...state.payments]
                .reverse()
                .slice(0, allPayments ? undefined : PAYMENTS_PREVIEW)
                .map((pay) => {
                  const orphaned = isOrphaned(state, pay)
                  return (
                    <div
                      key={pay.id}
                      className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate">{pay.debtName}</div>
                        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {formatDate(pay.date)}
                          {pay.auto && ' · auto (due date passed)'}
                          {pay.clearedDebt && ' · cleared it 🎉'}
                          {!pay.fromBank && !pay.auto && ' · not from bank'}
                          {orphaned && ' · debt since removed'}
                        </div>
                      </div>
                      <span
                        className="tabular-nums shrink-0 font-medium"
                        style={{ color: 'var(--status-good)' }}
                      >
                        −{formatCurrency(pay.amount)}
                      </span>
                      {/* No debt to put the money back onto: history, not reversible. */}
                      {!orphaned && (
                        <button
                          type="button"
                          onClick={() => setState((s) => undoPayment(s, pay.id))}
                          className="shrink-0 rounded-md px-2 py-0.5 text-[11px]"
                          style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  )
                })}
            </div>
            {(state.payments.length > PAYMENTS_PREVIEW || allPayments) && (
              <button
                type="button"
                onClick={() => setAllPayments((v) => !v)}
                className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium"
                style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}
              >
                {allPayments ? `Show the last ${PAYMENTS_PREVIEW}` : `Show all ${state.payments.length} payments`}
              </button>
            )}
          </Card>
        </section>
      )}

      {tabDebt && (
        <LedgerModal debt={tabDebt} setState={setState} onClose={() => setOpenTab(null)} />
      )}

      {paying && (
        <Modal title="Log a payment" onClose={() => setPaying(null)}>
          <PaymentForm
            state={state}
            initialDebtId={paying === 'any' ? undefined : paying}
            onSave={logPayment}
            onCancel={() => setPaying(null)}
          />
        </Modal>
      )}

      {editing && (
        <Modal title={editing === 'new' ? 'Add debt' : 'Edit debt'} onClose={() => edit(null)}>
          <DebtForm
            initial={editing === 'new' ? undefined : editing}
            onSave={save}
            onCancel={() => edit(null)}
          />

          {/* A due date moved by agreement. Editing the raw date loses the fact
              that it was agreed, with whom, and from when. */}
          {editing !== 'new' && isDate(editing.nextDue) && !deferring && (
            <button
              type="button"
              onClick={() => setDeferring(true)}
              className="mt-3 w-full rounded-lg py-2 text-sm font-medium"
              style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}
            >
              Log a deferral — the lender agreed to a later date
            </button>
          )}
          {editing !== 'new' && isDate(editing.nextDue) && deferring && (
            <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--surface-page)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Deferral from {formatShortDate(editing.nextDue)}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  New due date
                  <input
                    type="date"
                    value={deferTo}
                    min={editing.nextDue}
                    onChange={(e) => setDeferTo(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={{ background: 'var(--surface-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Who agreed, reference
                  <input
                    value={deferNote}
                    placeholder="Affirm chat, ref 4821"
                    onChange={(e) => setDeferNote(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={{ background: 'var(--surface-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </label>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeferring(false)}
                  className="flex-1 rounded-lg py-2 text-xs font-medium"
                  style={{ background: 'var(--surface-card)', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!isDate(deferTo) || deferTo <= editing.nextDue}
                  onClick={() => logDeferral(editing)}
                  className="flex-1 rounded-lg py-2 text-xs font-medium disabled:opacity-40"
                  style={{ background: 'var(--status-warning)', color: '#0d0d0d' }}
                >
                  Move it to {isDate(deferTo) ? formatShortDate(deferTo) : '…'}
                </button>
              </div>
            </div>
          )}

          {/* Deleting takes its payment history with it in spirit — the records
              stay, but there is nothing left to undo them onto. So it asks. */}
          {editing !== 'new' && (
            <button
              type="button"
              onClick={() =>
                confirmDelete === editing.id ? remove(editing.id) : setConfirmDelete(editing.id)
              }
              className="mt-3 w-full rounded-lg py-2 text-sm font-medium"
              style={{
                background: confirmDelete === editing.id ? 'var(--status-critical)' : 'transparent',
                color: confirmDelete === editing.id ? 'white' : 'var(--status-critical)',
              }}
            >
              {confirmDelete !== editing.id
                ? 'Delete debt'
                : paymentsOwedBy(editing.id) > 0
                  ? `Delete for good — its ${paymentsOwedBy(editing.id)} logged payment${paymentsOwedBy(editing.id) === 1 ? '' : 's'} can no longer be undone`
                  : 'Delete for good'}
            </button>
          )}
        </Modal>
      )}
    </div>
  )
}
