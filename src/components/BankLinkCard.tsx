import { useEffect, useState } from 'react'
import type { AppState } from '../types'
import { Card } from './Card'
import { formatCurrency } from '../lib/finance'
import { today } from '../lib/schedule'
import {
  cleanWorkerUrl,
  fetchAccounts,
  linkBank,
  loadBankLink,
  saveBankLink,
  spendable,
  type BankLinkConfig,
  type LinkedAccount,
} from '../lib/bankLink'

const inputStyle = {
  background: 'var(--surface-page)',
  borderColor: 'var(--border)',
  color: 'var(--text-primary)',
}

function asOfLabel(iso: string | null): string {
  if (!iso) return 'time unknown'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? 'time unknown'
    : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function BankLinkCard({
  state,
  setState,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}) {
  const [config, setConfig] = useState<BankLinkConfig | null>(() => loadBankLink())
  const [urlInput, setUrlInput] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [accounts, setAccounts] = useState<LinkedAccount[]>([])
  const [busy, setBusy] = useState<null | 'link' | 'refresh' | 'load'>(null)
  const [note, setNote] = useState<string | null>(null)

  function remember(next: BankLinkConfig | null) {
    saveBankLink(next)
    setConfig(next)
  }

  async function load(refresh: boolean) {
    if (!config?.customerId) return
    setBusy(refresh ? 'refresh' : 'load')
    setNote(null)
    try {
      setAccounts(await fetchAccounts(config, refresh))
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not load balances')
    } finally {
      setBusy(null)
    }
  }

  // Show what is already linked when the card opens, without asking the bank
  // for a fresh figure — that costs a call and is rate-limited by Stripe.
  // Only on opening: keyed to the customer id, it fired again the moment a
  // first link saved one, wiping the "Linked 1 account" confirmation and
  // fetching the same accounts twice. Linking fetches its own.
  useEffect(() => {
    void load(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function link() {
    if (!config) return
    setBusy('link')
    setNote(null)
    try {
      const { customerId, linked } = await linkBank(config)
      const next = { ...config, customerId }
      remember(next)
      setNote(linked > 0 ? `Linked ${linked} account${linked === 1 ? '' : 's'}.` : 'Nothing was linked.')
      setAccounts(await fetchAccounts(next, false))
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Linking failed')
    } finally {
      setBusy(null)
    }
  }

  function applyBalance(amount: number, label: string) {
    setState((s) => ({ ...s, bankBalance: { amount, updatedAt: today() } }))
    setNote(`Bank balance set to ${formatCurrency(amount)} from ${label}.`)
  }

  const testMode = accounts.length > 0 ? accounts.some((a) => !a.livemode) : null

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Bank balance from Stripe
        </h2>
        {testMode && (
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
            style={{ background: 'var(--status-warning)', color: 'white' }}
          >
            Test mode
          </span>
        )}
      </div>

      {!config ? (
        <>
          {/*
            Says plainly what leaves the phone, since until now the answer was
            "nothing". The bank login itself never touches this app.
          */}
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Pulls your real balance instead of you typing it. Needs the small server in the
            repo's <code>worker/</code> folder set up first. Your bank login happens on Stripe's
            screen; this app only ever receives the balance. Everything else stays on this phone.
          </p>
          <label className="mt-3 flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Worker URL
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://p-finance-bank.you.workers.dev"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
            />
          </label>
          <label className="mt-2 flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Access token
            <input
              type="password"
              autoComplete="off"
              placeholder="the APP_TOKEN you gave the worker"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const workerUrl = cleanWorkerUrl(urlInput)
              if (!workerUrl) return setNote('That URL needs to start with https://')
              if (tokenInput.trim().length < 24) return setNote('The token should be at least 24 characters.')
              remember({ workerUrl, token: tokenInput.trim() })
              setUrlInput('')
              setTokenInput('')
              setNote('Saved on this phone. Not included in backups.')
            }}
            className="mt-3 w-full rounded-lg py-2 text-sm font-medium"
            style={{ background: 'var(--cat-installment)', color: 'white' }}
          >
            Save
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 break-all text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Via {config.workerUrl}
          </p>

          {accounts.length > 0 && (
            <ul className="mt-3 flex flex-col gap-3">
              {accounts.map((a) => {
                const label = `${a.institution ?? 'Bank'}${a.last4 ? ` ••${a.last4}` : ''}`
                const money = spendable(a.balance)
                return (
                  <li key={a.id} className="rounded-lg p-2" style={{ background: 'var(--surface-page)' }}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-medium">{label}</span>
                      <span className="tabular-nums shrink-0 font-semibold">
                        {a.balance?.current != null ? formatCurrency(a.balance.current) : '—'}
                      </span>
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {a.name ?? a.subcategory ?? a.category ?? 'Account'}
                      {a.balance
                        ? ` · as of ${asOfLabel(a.balance.asOf)}`
                        : a.refresh.status === 'pending'
                          ? ' · balance still loading, refresh in a minute'
                          : a.refresh.status === 'failed'
                            ? ' · the bank did not return a balance'
                            : ' · no balance yet'}
                      {a.status !== 'active' && ` · ${a.status}`}
                    </p>
                    {a.balance?.type === 'cash' &&
                      a.balance.available != null &&
                      a.balance.current != null &&
                      a.balance.available !== a.balance.current && (
                        // The gap is pending charges — autopays already in flight.
                        <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                          {formatCurrency(a.balance.available)} available after pending charges
                        </p>
                      )}
                    {money != null && (
                      <button
                        type="button"
                        onClick={() => applyBalance(money, label)}
                        className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium"
                        style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }}
                      >
                        Use {formatCurrency(money)} as my bank balance
                        {Math.abs(money - state.bankBalance.amount) >= 0.01 &&
                          ` (app has ${formatCurrency(state.bankBalance.amount)})`}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void link()}
              className="flex-1 rounded-lg py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--cat-installment)', color: 'white' }}
            >
              {busy === 'link' ? 'Opening Stripe…' : accounts.length ? 'Link another' : 'Link a bank account'}
            </button>
            {config.customerId && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void load(true)}
                className="flex-1 rounded-lg py-2 text-sm font-medium disabled:opacity-50"
                style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}
              >
                {busy === 'refresh' ? 'Asking the bank…' : 'Refresh balances'}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              remember(null)
              setAccounts([])
              setNote('Forgotten on this phone. Linked accounts stay in your Stripe dashboard until you remove them there.')
            }}
            className="mt-2 w-full text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            Forget this link on this phone
          </button>
        </>
      )}

      {note && (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {note}
        </p>
      )}
    </Card>
  )
}
