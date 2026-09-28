// @ts-check
/**
 * The one piece of P-Finance that does not run on the phone.
 *
 * The app is static files on GitHub Pages, readable by anyone, so it cannot
 * hold a Stripe secret key — shipping one in the bundle would publish it. This
 * worker holds the key instead and does exactly two things with it: open a
 * Stripe Financial Connections session so a bank can be linked, and read back
 * the balances of the accounts linked that way.
 *
 * It stores nothing. There is no database here: Stripe keeps the linked
 * accounts, the phone keeps everything else, and this sits in between only
 * for the length of a request.
 *
 * Written as plain JavaScript on purpose, so the whole file can be pasted into
 * the Cloudflare dashboard's editor without a build step or a terminal.
 */

const STRIPE = 'https://api.stripe.com/v1'
const DEFAULT_ORIGINS = ['https://1morepush.github.io']

/** How long to wait for a balance refresh before answering with what is known. */
const POLL_ATTEMPTS = 4
const POLL_INTERVAL_MS = 1500

/**
 * @typedef {object} Env
 * @property {string} [STRIPE_SECRET_KEY]
 * @property {string} [STRIPE_PUBLISHABLE_KEY]
 * @property {string} [APP_TOKEN] Shared secret the phone sends. Not the Stripe key.
 * @property {string} [ALLOWED_ORIGINS] Comma-separated, for local testing.
 */

/**
 * @typedef {object} Balance
 * @property {'cash' | 'credit'} type
 * @property {number | null} current Posted balance, dollars.
 * @property {number | null} available Cash accounts: spendable after holds.
 * @property {number | null} used Credit accounts: drawn after holds.
 * @property {string | null} asOf When the bank calculated it — not when it was fetched.
 */

/**
 * @typedef {object} LinkedAccount
 * @property {string} id
 * @property {string | null} institution
 * @property {string | null} name
 * @property {string | null} last4
 * @property {string | null} category
 * @property {string | null} subcategory
 * @property {string} status
 * @property {boolean} livemode
 * @property {Balance | null} balance
 * @property {{ status: string | null, nextAvailableAt: string | null }} refresh
 */

export default {
  /**
   * @param {Request} request
   * @param {Env} env
   */
  fetch(request, env) {
    return handle(request, env)
  },
}

/**
 * The whole worker, with the network injectable so it can be tested without
 * Stripe on the other end.
 *
 * @param {Request} request
 * @param {Env} env
 * @param {typeof fetch} [fetchImpl]
 * @param {(ms: number) => Promise<void>} [sleep]
 * @returns {Promise<Response>}
 */
export async function handle(
  request,
  env,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
) {
  const origin = request.headers.get('Origin')
  const allowed = (env.ALLOWED_ORIGINS ?? DEFAULT_ORIGINS.join(','))
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  // A browser on some other site gets nothing — not even a CORS header that
  // would let it read the refusal. Requests with no Origin at all are not from
  // a browser page, and still have to get past the token below.
  if (origin && !allowed.includes(origin)) return json({ error: 'Origin not allowed' }, 403, null)
  const cors = origin ?? null

  if (request.method === 'OPTIONS') return preflight(cors)

  // Refuse to run half-configured rather than fall back to something weaker.
  // A missing or short token would leave the Stripe key one guess away.
  if (!env.APP_TOKEN || env.APP_TOKEN.length < 24) {
    return json({ error: 'Worker is not configured: APP_TOKEN missing or shorter than 24 characters' }, 500, cors)
  }
  if (!env.STRIPE_SECRET_KEY || !/^(sk|rk)_(test|live)_/.test(env.STRIPE_SECRET_KEY)) {
    return json({ error: 'Worker is not configured: STRIPE_SECRET_KEY missing or malformed' }, 500, cors)
  }
  if (!env.STRIPE_PUBLISHABLE_KEY || !/^pk_(test|live)_/.test(env.STRIPE_PUBLISHABLE_KEY)) {
    return json({ error: 'Worker is not configured: STRIPE_PUBLISHABLE_KEY missing or malformed' }, 500, cors)
  }

  const auth = request.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!sameSecret(token, env.APP_TOKEN)) return json({ error: 'Wrong or missing access token' }, 401, cors)

  if (request.method !== 'POST') return json({ error: 'Use POST' }, 405, cors)

  /** @type {Record<string, unknown>} */
  let body
  try {
    const parsed = await request.json()
    body = parsed && typeof parsed === 'object' ? /** @type {Record<string, unknown>} */ (parsed) : {}
  } catch {
    return json({ error: 'Body must be JSON' }, 400, cors)
  }

  const stripe = stripeClient(env.STRIPE_SECRET_KEY, fetchImpl)
  const path = new URL(request.url).pathname

  try {
    if (path === '/session') {
      // One Stripe customer stands for the phone's owner. The phone remembers
      // its id and sends it back, so linking a second bank does not mint a
      // second customer with none of the first one's accounts.
      const known = validCustomer(body.customerId)
      const customerId =
        known ??
        /** @type {{ id: string }} */ (
          await stripe('POST', '/customers', [
            ['description', 'P-Finance owner'],
            ['metadata[app]', 'p-finance'],
          ])
        ).id

      const session = /** @type {{ client_secret: string, livemode: boolean }} */ (
        await stripe('POST', '/financial_connections/sessions', [
          ['account_holder[type]', 'customer'],
          ['account_holder[customer]', customerId],
          // Balances only. Transactions and ownership are more than a balance
          // needs, and every permission asked for is shown to you in the flow.
          ['permissions[]', 'balances'],
          ['prefetch[]', 'balances'],
          ['filters[countries][]', 'US'],
        ])
      )

      return json(
        {
          clientSecret: session.client_secret,
          publishableKey: env.STRIPE_PUBLISHABLE_KEY,
          customerId,
          livemode: session.livemode,
        },
        200,
        cors,
      )
    }

    if (path === '/accounts') {
      const customerId = validCustomer(body.customerId)
      if (!customerId) return json({ error: 'customerId is required — link a bank first' }, 400, cors)

      let accounts = await listAccounts(stripe, customerId)

      if (body.refresh === true) {
        const now = Math.floor(Date.now() / 1000)
        for (const a of accounts) {
          if (canRefresh(a, now)) {
            await stripe('POST', `/financial_connections/accounts/${a.id}/refresh`, [['features[]', 'balance']])
          }
        }
        accounts = await listAccounts(stripe, customerId)
      }

      // Refreshes finish asynchronously. Wait a few seconds for any still
      // pending — including ones started by the prefetch at link time — then
      // answer with whatever is known rather than hang.
      for (let i = 0; i < POLL_ATTEMPTS && accounts.some(isPending); i++) {
        await sleep(POLL_INTERVAL_MS)
        accounts = await listAccounts(stripe, customerId)
      }

      return json({ accounts: accounts.map(normalizeAccount) }, 200, cors)
    }

    return json({ error: 'Not found' }, 404, cors)
  } catch (err) {
    // Stripe's own message is safe to pass on and usually says what to fix.
    // The key itself never appears in it.
    const message = err instanceof StripeError ? err.message : 'Unexpected error talking to Stripe'
    return json({ error: message }, 502, cors)
  }
}

class StripeError extends Error {}

/**
 * @param {string} key
 * @param {typeof fetch} fetchImpl
 */
function stripeClient(key, fetchImpl) {
  /**
   * @param {'GET' | 'POST'} method
   * @param {string} path
   * @param {[string, string][]} [params]
   * @returns {Promise<unknown>}
   */
  return async function stripe(method, path, params = []) {
    const query = new URLSearchParams(params).toString()
    const url = method === 'GET' && query ? `${STRIPE}${path}?${query}` : `${STRIPE}${path}`
    const res = await fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      ...(method === 'POST' ? { body: query } : {}),
    })
    const data = /** @type {any} */ (await res.json().catch(() => ({})))
    if (!res.ok) throw new StripeError(data?.error?.message ?? `Stripe returned ${res.status}`)
    return data
  }
}

/**
 * @param {ReturnType<typeof stripeClient>} stripe
 * @param {string} customerId
 * @returns {Promise<any[]>}
 */
async function listAccounts(stripe, customerId) {
  const list = /** @type {{ data?: any[] }} */ (
    await stripe('GET', '/financial_connections/accounts', [
      ['account_holder[customer]', customerId],
      ['limit', '20'],
    ])
  )
  return list.data ?? []
}

/**
 * Stripe will not start a refresh on an inactive account, while one is already
 * pending, or before `next_refresh_available_at`. Asking anyway is not an
 * error, but it is a wasted call.
 *
 * @param {any} account
 * @param {number} nowSeconds
 */
export function canRefresh(account, nowSeconds) {
  if (account.status !== 'active') return false
  const r = account.balance_refresh
  if (!r) return true
  if (r.next_refresh_available_at == null) return false
  return nowSeconds >= r.next_refresh_available_at
}

/** @param {any} account */
function isPending(account) {
  return account.balance_refresh?.status === 'pending'
}

/**
 * Stripe's account object, reduced to what the phone shows, in dollars.
 *
 * Stripe reports cents keyed by currency. Only USD is read, since the only
 * accounts this can link are US ones.
 *
 * @param {any} a
 * @returns {LinkedAccount}
 */
export function normalizeAccount(a) {
  /** @param {any} money */
  const dollars = (money) => (money && typeof money.usd === 'number' ? money.usd / 100 : null)
  const b = a.balance
  return {
    id: a.id,
    institution: a.institution_name ?? null,
    name: a.display_name ?? null,
    last4: a.last4 ?? null,
    category: a.category ?? null,
    subcategory: a.subcategory ?? null,
    status: a.status ?? 'unknown',
    livemode: a.livemode === true,
    balance: b
      ? {
          type: b.type === 'credit' ? 'credit' : 'cash',
          current: dollars(b.current),
          available: b.type === 'cash' ? dollars(b.cash?.available) : null,
          used: b.type === 'credit' ? dollars(b.credit?.used) : null,
          asOf: typeof b.as_of === 'number' ? new Date(b.as_of * 1000).toISOString() : null,
        }
      : null,
    refresh: {
      status: a.balance_refresh?.status ?? null,
      nextAvailableAt:
        typeof a.balance_refresh?.next_refresh_available_at === 'number'
          ? new Date(a.balance_refresh.next_refresh_available_at * 1000).toISOString()
          : null,
    },
  }
}

/** @param {unknown} id */
function validCustomer(id) {
  return typeof id === 'string' && /^cus_[A-Za-z0-9]+$/.test(id) ? id : null
}

/**
 * Compares without stopping at the first mismatch, so response time does not
 * reveal how much of a guess was right.
 *
 * @param {string} a
 * @param {string} b
 */
export function sameSecret(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * @param {string | null} origin
 * @returns {Record<string, string>}
 */
function corsHeaders(origin) {
  return origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}
}

/** @param {string | null} origin */
function preflight(origin) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}

/**
 * @param {unknown} body
 * @param {number} status
 * @param {string | null} origin
 */
function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin),
    },
  })
}
