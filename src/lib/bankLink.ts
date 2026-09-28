/**
 * Linking a bank through Stripe Financial Connections, by way of the small
 * worker in /worker that holds the Stripe secret key.
 *
 * Everything here is kept out of AppState on purpose. AppState is what a
 * backup exports, and backups get copied into notes and sent to yourself —
 * the access token must not ride along. It lives under its own storage key,
 * on this device only.
 */

const CONFIG_KEY = 'p-finance/bank-link/v1'

export interface BankLinkConfig {
  /** The deployed worker, e.g. https://p-finance-bank.you.workers.dev */
  workerUrl: string
  /** The worker's APP_TOKEN. Not a Stripe key. */
  token: string
  /** The Stripe customer standing for you, once a first bank is linked. */
  customerId?: string
}

export interface LinkedBalance {
  type: 'cash' | 'credit'
  current: number | null
  available: number | null
  used: number | null
  asOf: string | null
}

export interface LinkedAccount {
  id: string
  institution: string | null
  name: string | null
  last4: string | null
  category: string | null
  subcategory: string | null
  status: string
  livemode: boolean
  balance: LinkedBalance | null
  refresh: { status: string | null; nextAvailableAt: string | null }
}

export function loadBankLink(): BankLinkConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BankLinkConfig>
    if (typeof parsed.workerUrl !== 'string' || typeof parsed.token !== 'string') return null
    return {
      workerUrl: parsed.workerUrl,
      token: parsed.token,
      ...(typeof parsed.customerId === 'string' ? { customerId: parsed.customerId } : {}),
    }
  } catch {
    return null
  }
}

export function saveBankLink(config: BankLinkConfig | null): void {
  try {
    if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
    else localStorage.removeItem(CONFIG_KEY)
  } catch {
    // Storage blocked: the link simply won't be remembered on this device.
  }
}

/**
 * Only https, so the token never crosses the network in the clear. Localhost
 * is let through for running the worker on a laptop while trying it out.
 */
export function cleanWorkerUrl(input: string): string | null {
  const trimmed = input.trim().replace(/\/+$/, '')
  try {
    const url = new URL(trimmed)
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null
    return `${url.origin}${url.pathname === '/' ? '' : url.pathname}`
  } catch {
    return null
  }
}

async function call<T>(config: BankLinkConfig, path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${config.workerUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Could not reach the worker. Check the URL and your connection.')
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(data.error ?? `The worker answered ${res.status}`)
  return data as T
}

export interface SessionStart {
  clientSecret: string
  publishableKey: string
  customerId: string
  livemode: boolean
}

export function startSession(config: BankLinkConfig): Promise<SessionStart> {
  return call<SessionStart>(config, '/session', { customerId: config.customerId })
}

export async function fetchAccounts(config: BankLinkConfig, refresh: boolean): Promise<LinkedAccount[]> {
  if (!config.customerId) return []
  const data = await call<{ accounts: LinkedAccount[] }>(config, '/accounts', {
    customerId: config.customerId,
    refresh,
  })
  return Array.isArray(data.accounts) ? data.accounts : []
}

/** The figure worth putting in the app: what can actually be spent. */
export function spendable(balance: LinkedBalance | null): number | null {
  if (!balance || balance.type !== 'cash') return null
  return balance.available ?? balance.current
}

interface StripeJs {
  collectFinancialConnectionsAccounts(options: { clientSecret: string }): Promise<{
    financialConnectionsSession?: { accounts: { id: string }[] }
    error?: { message?: string }
  }>
}

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeJs
  }
}

const STRIPE_JS = 'https://js.stripe.com/v3/'
let stripeJs: Promise<NonNullable<Window['Stripe']>> | null = null

/**
 * Stripe.js is only fetched when a bank is actually being linked, so nobody
 * who never uses this feature loads a third-party script.
 */
function loadStripeJs(): Promise<NonNullable<Window['Stripe']>> {
  if (window.Stripe) return Promise.resolve(window.Stripe)
  stripeJs ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = STRIPE_JS
    script.async = true
    script.onload = () => (window.Stripe ? resolve(window.Stripe) : reject(new Error('Stripe.js loaded without Stripe')))
    script.onerror = () => {
      stripeJs = null
      reject(new Error('Could not load Stripe.js'))
    }
    document.head.appendChild(script)
  })
  return stripeJs
}

/**
 * Runs Stripe's own linking screen. Your bank login happens there, on Stripe's
 * side — neither this app nor the worker ever sees it.
 *
 * Returns the customer id to remember, and how many accounts were linked.
 */
export async function linkBank(config: BankLinkConfig): Promise<{ customerId: string; linked: number; livemode: boolean }> {
  const session = await startSession(config)
  const Stripe = await loadStripeJs()
  const result = await Stripe(session.publishableKey).collectFinancialConnectionsAccounts({
    clientSecret: session.clientSecret,
  })
  if (result.error) throw new Error(result.error.message ?? 'Stripe could not link the account')
  return {
    customerId: session.customerId,
    linked: result.financialConnectionsSession?.accounts.length ?? 0,
    livemode: session.livemode,
  }
}
