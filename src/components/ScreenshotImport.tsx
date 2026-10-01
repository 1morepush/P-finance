import { useRef, useState } from 'react'
import type { AppState } from '../types'
import { Modal } from './Modal'
import { formatCurrency } from '../lib/finance'
import { formatShortDate, isDate } from '../lib/schedule'
import { closeReader, readImage } from '../lib/ocr'
import { applyProposals, changesFor, propose, readPage, type Proposal, type Reading } from '../lib/screenshot'

const LENDER: Record<string, string> = { affirm: 'Affirm', klarna: 'Klarna', paypal: 'PayPal', bank: 'Bank' }

const inputStyle = {
  background: 'var(--surface-page)',
  borderColor: 'var(--border)',
  color: 'var(--text-primary)',
}

/** A proposal as the review screen holds it: every figure still editable. */
interface Draft {
  proposal: Proposal
  include: boolean
  debtId: string
  balance: string
  nextDue: string
}

function effective(d: Draft): Proposal {
  const balance = d.balance.trim() === '' ? undefined : Number(d.balance)
  return {
    ...d.proposal,
    debtId: d.proposal.kind === 'debt' ? d.debtId || undefined : undefined,
    balance: balance !== undefined && Number.isFinite(balance) ? balance : undefined,
    nextDue: isDate(d.nextDue) ? d.nextDue : undefined,
  }
}

const show = (v: number | string | undefined) =>
  v === undefined ? '—' : typeof v === 'number' ? formatCurrency(v) : isDate(v) ? formatShortDate(v) : v

/**
 * A button that reads screenshots of the bank or a lender's app and offers
 * the figures it finds. Placed wherever a figure might be stale — beside the
 * bank balance, and beside the box for telling the app what happened.
 */
export function ScreenshotImport({
  state,
  setState,
  label = '📷 Screenshot',
  className = 'rounded-lg px-3 py-1.5 text-xs font-medium',
  style = { background: 'var(--surface-page)', color: 'var(--text-secondary)' },
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
  label?: string
  className?: string
  style?: React.CSSProperties
}) {
  const picker = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [unread, setUnread] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState<string[] | null>(null)

  function close() {
    setOpen(false)
    setDrafts(null)
    setUnread([])
    setError(null)
    setApplied(null)
    setStatus(null)
  }

  async function read(files: File[]) {
    setOpen(true)
    setDrafts(null)
    setApplied(null)
    setError(null)
    const readings: Reading[] = []
    try {
      for (const [i, file] of files.entries()) {
        const label = files.length > 1 ? `Reading ${i + 1} of ${files.length}…` : 'Reading…'
        setStatus(label)
        const page = await readImage(file, (p) =>
          setStatus(
            p.stage === 'loading'
              ? `Getting the reader ready… ${Math.round(p.progress * 100)}%`
              : `${label} ${Math.round(p.progress * 100)}%`,
          ),
        )
        readings.push(readPage(page))
      }
    } catch (e) {
      setError(
        `Could not read the screenshots${e instanceof Error && e.message ? ` (${e.message})` : ''}. ` +
          'The first time, the reader has to download, so it needs a connection.',
      )
      setStatus(null)
      return
    } finally {
      void closeReader()
    }
    const { proposals, unread } = propose(readings, state)
    setUnread(unread.map((i) => files[i]?.name || `Screenshot ${i + 1}`))
    setDrafts(
      proposals.map((p) => ({
        proposal: p,
        // Ticked only when something would change and the match is sure. An
        // unsure match is shown, with its figures, but left for you to tick.
        include: changesFor(p, state).length > 0 && p.confident,
        debtId: p.debtId ?? '',
        balance: p.balance !== undefined ? String(p.balance) : '',
        nextDue: p.nextDue ?? '',
      })),
    )
    setStatus(null)
  }

  function update(i: number, patch: Partial<Draft>) {
    setDrafts((ds) => ds && ds.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  }

  const chosen = (drafts ?? []).filter((d) => d.include && changesFor(effective(d), state).length > 0)

  function apply() {
    const accepted = chosen.map(effective)
    setState((s) => applyProposals(s, accepted))
    setApplied(
      accepted.map((p) =>
        p.kind === 'bank' ? 'Bank balance' : (state.debts.find((d) => d.id === p.debtId)?.name ?? 'A plan'),
      ),
    )
    setDrafts(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => picker.current?.click()}
        className={className}
        style={style}
        aria-label="Update from screenshots"
      >
        {label}
      </button>
      <input
        ref={picker}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Screenshots to read"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          // Cleared so picking the same pictures again still fires.
          e.target.value = ''
          if (files.length) void read(files)
        }}
      />

      {open && (
        <Modal title="Read screenshots" onClose={close}>
          <p className="mb-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Read on this phone — nothing is uploaded or kept, and nothing changes until you say so.
          </p>
          {status && (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }} role="status">
              {status}
            </p>
          )}

          {error && (
            <p className="text-sm" style={{ color: 'var(--status-warning)' }}>
              {error}
            </p>
          )}

          {applied && (
            <div className="flex flex-col gap-2 text-sm">
              <p style={{ color: 'var(--status-good)' }}>
                ✓ Updated {applied.length === 1 ? applied[0] : `${applied.length}: ${applied.join(', ')}`}.
              </p>
              <button
                type="button"
                onClick={close}
                className="rounded-lg py-2 text-sm font-medium"
                style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}
              >
                Done
              </button>
            </div>
          )}

          {drafts && (
            <div className="flex flex-col gap-3">
              {drafts.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Nothing in these screenshots could be matched to your accounts.
                </p>
              )}

              {drafts.map((d, i) => {
                const p = effective(d)
                const changes = changesFor(p, state)
                const debt = state.debts.find((x) => x.id === d.debtId)
                const current = p.kind === 'bank' ? state.bankBalance.amount : debt?.balance
                return (
                  <div
                    key={i}
                    className="rounded-lg border p-3"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-page)' }}
                    data-testid="screenshot-proposal"
                  >
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {LENDER[d.proposal.lender] ?? 'Screenshot'}
                      {d.proposal.sources.length > 1 && ` · ${d.proposal.sources.length} screenshots`}
                    </div>
                    <div className="text-sm font-semibold">{d.proposal.title || 'Untitled screen'}</div>

                    {p.kind === 'debt' && (
                      <label className="mt-2 flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Which of your plans
                        <select
                          value={d.debtId}
                          onChange={(e) => update(i, { debtId: e.target.value })}
                          className="rounded-lg border px-2 py-1.5 text-sm"
                          style={inputStyle}
                        >
                          <option value="">Not one of these</option>
                          {d.proposal.candidates.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {p.kind === 'debt' && d.debtId && !d.proposal.confident && d.debtId === d.proposal.debtId && (
                      <p className="mt-1 text-[11px]" style={{ color: 'var(--status-warning)' }}>
                        A best guess from the amounts — check it is the right plan.
                      </p>
                    )}

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {p.kind === 'bank' ? 'Available ($)' : 'Left to pay ($)'}
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={d.balance}
                          placeholder="not shown"
                          onChange={(e) => update(i, { balance: e.target.value })}
                          className="rounded-lg border px-2 py-1.5 text-sm"
                          style={inputStyle}
                        />
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          App has {show(current)}
                        </span>
                      </label>
                      {p.kind === 'debt' && (
                        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          Next due
                          <input
                            type="date"
                            value={d.nextDue}
                            onChange={(e) => update(i, { nextDue: e.target.value })}
                            className="rounded-lg border px-2 py-1.5 text-sm"
                            style={inputStyle}
                          />
                          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            App has {show(debt?.nextDue)}
                          </span>
                        </label>
                      )}
                    </div>

                    {p.kind === 'debt' && !d.debtId ? (
                      <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        Not matched to a plan, so nothing will change.
                      </p>
                    ) : changes.length === 0 ? (
                      <p className="mt-2 text-xs" style={{ color: 'var(--status-good)' }}>
                        ✓ Matches the app — nothing to change.
                      </p>
                    ) : (
                      <label className="mt-2 flex items-start gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={d.include}
                          onChange={(e) => update(i, { include: e.target.checked })}
                          className="mt-0.5"
                        />
                        <span>
                          Update{' '}
                          {changes
                            .map((c) =>
                              c.field === 'balance'
                                ? `${p.kind === 'bank' ? 'balance' : 'left to pay'} ${show(c.from)} → ${show(c.to)}`
                                : `next due ${show(c.from)} → ${show(c.to)}`,
                            )
                            .join(', ')}
                        </span>
                      </label>
                    )}
                  </div>
                )
              })}

              {unread.length > 0 && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Could not tell what {unread.length === 1 ? 'this one shows' : 'these show'}:{' '}
                  {unread.join(', ')}. Screens that work: a bank account's balance, or one plan in
                  Affirm, Klarna or PayPal.
                </p>
              )}

              <button
                type="button"
                onClick={apply}
                disabled={chosen.length === 0}
                className="rounded-lg py-2 text-sm font-medium disabled:opacity-40"
                style={{ background: 'var(--status-good)', color: 'white' }}
              >
                {chosen.length === 0
                  ? 'Nothing to update'
                  : `Update ${chosen.length} ${chosen.length === 1 ? 'thing' : 'things'}`}
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
