import type { AppState, Debt, DebtProduct, DebtStatus, PriorityTier } from '../types'
import { PRODUCT_LABEL } from '../types'
import { activeDebts, formatCurrency, orderByStrategy } from './finance'
import { addShift, type ShiftInput } from './gig'
import { applyPayment, nextDueAfter, type PaymentInput } from './payments'
import { addDays, formatShortDate, today } from './schedule'
import { uid } from './id'

/**
 * Turns a typed sentence into one concrete change to the app.
 *
 * Deliberately a rule parser rather than a language model: the vocabulary that
 * matters here is the user's own debt names, the arithmetic has to be exact,
 * and the figures never leave the phone. Nothing is applied from a parse —
 * every result is shown for confirmation first, because a misread sentence
 * that moves money is worse than one that asks again.
 */

export type Action =
  | { kind: 'payment'; input: PaymentInput; debt: Debt }
  | { kind: 'new-debt'; debt: Debt }
  | { kind: 'income'; amount: number; date: string; note?: string }
  | { kind: 'shift'; input: ShiftInput }
  | { kind: 'bank'; amount: number }

export interface Understanding {
  action: Action
  /** One-line headline of what will happen. */
  summary: string
  /** The specific consequences, each already worked out. */
  lines: string[]
  /** Something true but worth seeing before confirming. */
  warning?: string
}

export type ParseResult =
  | { status: 'ok'; understanding: Understanding }
  | { status: 'choose'; message: string; options: Understanding[] }
  | { status: 'unclear'; message: string }

/** Applies a confirmed action. Every branch routes through the same code paths the forms use. */
export function applyAction(state: AppState, action: Action): AppState {
  switch (action.kind) {
    case 'payment':
      return applyPayment(state, action.input)
    case 'new-debt':
      return { ...state, debts: [...state.debts, action.debt] }
    case 'income':
      return {
        ...state,
        bankBalance: { amount: state.bankBalance.amount + action.amount, updatedAt: action.date },
        incomeEntries: [
          ...state.incomeEntries,
          {
            id: uid(),
            date: action.date,
            amount: action.amount,
            ...(action.note ? { note: action.note } : {}),
          },
        ],
      }
    case 'shift':
      return addShift(state, action.input)
    case 'bank':
      return { ...state, bankBalance: { amount: action.amount, updatedAt: today() } }
  }
}

// ---------------------------------------------------------------- scanning

interface Scan {
  /** The sentence with every recognised token removed, for name extraction. */
  rest: string
  date: string
  dateGiven: boolean
  percent?: number
  perMonth?: number
  hours?: number
  miles?: number
  gas?: number
  /** Amounts left over once labelled figures are accounted for, in order. */
  money: number[]
}

const num = (s: string) => Number(s.replace(/[$,]/g, ''))

const MONEY_SRC = '\\$?\\d[\\d,]*(?:\\.\\d{1,2})?'

function scan(text: string, now: string): Scan {
  let rest = ` ${text.toLowerCase()} `
  const out: Partial<Scan> = {}

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = rest.match(re)
    if (!m) return
    fn(m)
    rest = rest.replace(re, ' ')
  }

  // Dates first, so 9/5 is never read as two amounts.
  take(/\b(\d{4})-(\d{2})-(\d{2})\b/, (m) => {
    out.date = `${m[1]}-${m[2]}-${m[3]}`
    out.dateGiven = true
  })
  take(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, (m) => {
    const month = Number(m[1])
    const day = Number(m[2])
    if (month < 1 || month > 12 || day < 1 || day > 31) return
    let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(now.slice(0, 4))
    const iso = () => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    // A bare month/day that lands in the future almost always means last year.
    if (!m[3] && iso() > addDays(now, 30)) year -= 1
    out.date = iso()
    out.dateGiven = true
  })
  take(/\b(today|yesterday)\b/, (m) => {
    out.date = m[1] === 'yesterday' ? addDays(now, -1) : now
    out.dateGiven = true
  })

  // Rates, so "36%" is never read as $36.
  take(/(\d+(?:\.\d+)?)\s*%/, (m) => {
    out.percent = Number(m[1])
  })
  take(/\b(?:apr|interest|rate)\s*(?:of|is|at)?\s*(\d+(?:\.\d+)?)\b/, (m) => {
    if (out.percent === undefined) out.percent = Number(m[1])
  })

  // Recurring payments, before the amount sweep claims the figure.
  take(
    new RegExp(`(${MONEY_SRC})\\s*(?:\\/\\s*(?:mo|month)\\b|per month|a month|each month|monthly)`),
    (m) => {
      out.perMonth = num(m[1])
    },
  )

  take(/\b(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|h)\b/, (m) => {
    out.hours = Number(m[1])
  })
  take(/\b(\d+(?:\.\d+)?)\s*(?:mi|miles?)\b/, (m) => {
    out.miles = Number(m[1])
  })

  // Fuel, either side of the word.
  take(new RegExp(`(${MONEY_SRC})\\s*(?:in|of|on|for)?\\s*(?:gas|fuel|petrol)\\b`), (m) => {
    out.gas = num(m[1])
  })
  take(new RegExp(`\\b(?:gas|fuel|petrol)\\b\\D{0,12}(${MONEY_SRC})`), (m) => {
    if (out.gas === undefined) out.gas = num(m[1])
  })

  const money = (rest.match(new RegExp(MONEY_SRC, 'g')) ?? [])
    .map(num)
    .filter((n) => !Number.isNaN(n))
  rest = rest.replace(new RegExp(MONEY_SRC, 'g'), ' ')

  return {
    rest: rest.replace(/\s+/g, ' ').trim(),
    date: out.date ?? now,
    dateGiven: out.dateGiven ?? false,
    percent: out.percent,
    perMonth: out.perMonth,
    hours: out.hours,
    miles: out.miles,
    gas: out.gas,
    money,
  }
}

// ---------------------------------------------------------- debt targeting

const NOISE = new Set([
  'the', 'a', 'an', 'my', 'to', 'toward', 'towards', 'on', 'for', 'of', 'and', 'i', 'it',
  'pay', 'paid', 'put', 'new', 'more', 'some', 'extra', 'off', 'this', 'that', 'debt',
  'card', 'with', 'from', 'at', 'is', 'was', 'in', 'into', 'made', 'up',
])

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Weights each word in a debt name by how rare it is across the whole list, so
 * "omio" identifies a debt and "affirm" — shared by five of them — does not.
 */
function nameWeights(debts: Debt[]): Map<string, number> {
  const docs = debts.map((d) => new Set(words(d.name).filter((w) => !NOISE.has(w))))
  const counts = new Map<string, number>()
  for (const doc of docs) for (const w of doc) counts.set(w, (counts.get(w) ?? 0) + 1)
  const weights = new Map<string, number>()
  for (const [w, n] of counts) weights.set(w, 1 + Math.log(docs.length / n))
  return weights
}

interface Scored {
  debt: Debt
  score: number
}

function scoreByName(text: string, debts: Debt[]): Scored[] {
  const said = new Set(words(text))
  const weights = nameWeights(debts)
  return debts
    .map((debt) => {
      const own = new Set(words(debt.name).filter((w) => !NOISE.has(w)))
      let score = 0
      for (const w of own) if (said.has(w)) score += weights.get(w) ?? 1
      return { debt, score }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
}

/** A superlative like "highest APR" names a debt just as precisely as its name does. */
function bySuperlative(text: string, state: AppState): { debt: Debt; why: string } | null {
  const debts = activeDebts(state.debts)
  if (!debts.length) return null
  const t = ` ${text.toLowerCase()} `

  if (/\b(?:high(?:est)?|worst|most)\b[^.]{0,16}\b(?:apr|interest|rate)\b/.test(t) || /\bhigh apr\b/.test(t)) {
    const best = [...debts].sort((a, b) => b.apr - a.apr || b.balance - a.balance)[0]
    return best.apr > 0 ? { debt: best, why: `highest APR at ${best.apr}%` } : null
  }
  if (/\b(?:smallest|lowest)\b[^.]{0,16}\bbalance\b|\bsmallest\b/.test(t)) {
    const best = [...debts].sort((a, b) => a.balance - b.balance)[0]
    return { debt: best, why: 'smallest balance' }
  }
  if (/\b(?:biggest|largest)\b|\bhighest balance\b/.test(t)) {
    const best = [...debts].sort((a, b) => b.balance - a.balance)[0]
    return { debt: best, why: 'largest balance' }
  }
  if (/\bnext\b|\bpriority\b|\btop\b|\bfocus\b/.test(t)) {
    const best = orderByStrategy(state.debts, state.settings.strategy)[0]
    return best ? { debt: best, why: 'first in your payoff order' } : null
  }
  return null
}

// ------------------------------------------------------------------ intents

const PLATFORMS: [RegExp, string][] = [
  [/\bdoor\s?dash\b|\bdash(?:ed|ing)?\b|\bdd\b/, 'DoorDash'],
  [/\buber\s?eats\b|\bubereats\b/, 'Uber Eats'],
  [/\binstacart\b/, 'Instacart'],
  [/\bgrub\s?hub\b/, 'Grubhub'],
  [/\bamazon\s?flex\b/, 'Amazon Flex'],
  [/\bspark\b/, 'Spark'],
  [/\blyft\b/, 'Lyft'],
]

const INCOME_STRONG =
  /\bgot paid\b|\bwas paid\b|\bpay ?check\b|\bunemployment\b|\bincome\b|\bdirect deposit\b|\bcheck (?:came|hit|landed|cleared)\b/
// "new debt", but also "new Affirm debt" / "new loan from Sam" — the lender sits
// between the two words that carry the intent.
const NEW_DEBT = /\bnew\b[^.]{0,20}\b(?:debt|loan|plan)\b|\badd (?:a |another )?(?:debt|loan)\b|\bi owe\b|\bborrowed\b|\btook out\b|\bfinanced\b/
const BANK_SET = /\bbank (?:balance|account)\b|\bbalance is\b|\bset (?:my )?(?:bank|balance)\b|\bchecking is\b/
const PAY_VERB = /\bpaid?\b|\bpay(?:ing|ment)?\b|\bput\b|\bdeposit(?:ed)?\b|\bsent\b|\bthrew\b|\bapplied\b|\bknocked\b|\bchipped\b|\btoward\b|\btowards\b|\bcleared\b|\bsettled\b/
const PAY_OFF = /\bpaid? (?:it )?off\b|\bpay(?:ing)? off\b|\bcleared?\b|\bsettled?\b|\bwiped\b|\bzeroed\b/
const INCOME_WEAK = /\breceived\b|\bdeposit(?:ed)?\b|\bearned\b|\bmade\b|\bcame in\b/

export function parseCommand(text: string, state: AppState, now = today()): ParseResult {
  const raw = text.trim()
  if (!raw) return { status: 'unclear', message: '' }

  const s = scan(raw, now)
  const t = ` ${raw.toLowerCase()} `

  if (BANK_SET.test(t) && !PAY_VERB.test(t)) return bank(s)
  if (INCOME_STRONG.test(t) && !/\btoward|\btowards\b/.test(t)) return income(s, raw)

  const platform = PLATFORMS.find(([re]) => re.test(t))
  // "delivered" is deliberately not a trigger — "delivered 20 to Liv" is a payment.
  if (platform || /\bshift\b|\bdeliver(?:y|ies)\b/.test(t)) {
    return shift(s, platform?.[1] ?? 'Gig work')
  }

  if (NEW_DEBT.test(t)) return newDebt(s, state, raw)
  if (PAY_VERB.test(t)) return payment(s, state, raw)
  if (INCOME_WEAK.test(t)) return income(s, raw)

  return {
    status: 'unclear',
    message:
      "I couldn't tell what that was. Start with what you did — paid, got paid, owe, or dashed.",
  }
}

// ----------------------------------------------------------------- builders

function bank(s: Scan): ParseResult {
  const amount = s.money[0]
  if (amount === undefined) {
    return { status: 'unclear', message: 'Setting the bank balance needs an amount.' }
  }
  return {
    status: 'ok',
    understanding: {
      action: { kind: 'bank', amount },
      summary: `Set bank balance to ${formatCurrency(amount)}`,
      lines: ['Replaces the balance outright — it does not add to it.'],
    },
  }
}

function income(s: Scan, raw: string): ParseResult {
  const amount = s.money[0]
  if (amount === undefined) {
    return { status: 'unclear', message: 'How much came in? Try "got paid 335".' }
  }
  const source = /\bunemployment\b/i.test(raw)
    ? 'Unemployment'
    : /\bupwork\b|\bfreelance\b/i.test(raw)
      ? 'Freelance'
      : undefined
  return {
    status: 'ok',
    understanding: {
      action: { kind: 'income', amount, date: s.date, note: source },
      summary: `Log ${formatCurrency(amount)} of income`,
      lines: [
        `Dated ${formatShortDate(s.date)}${source ? ` · ${source}` : ''}`,
        `Adds ${formatCurrency(amount)} to your bank balance.`,
      ],
    },
  }
}

function shift(s: Scan, platform: string): ParseResult {
  // With one figure and a gas cost, the plain amount is the earnings.
  const earnings = s.money[0]
  const gas = s.gas ?? (s.money.length > 1 ? s.money[1] : 0)
  if (earnings === undefined) {
    return { status: 'unclear', message: 'How much did the shift earn? Try "doordash 120, 25 gas".' }
  }
  const net = earnings - gas
  const input: ShiftInput = {
    date: s.date,
    platform,
    earnings,
    gasCost: gas,
    ...(s.hours ? { hours: s.hours } : {}),
    ...(s.miles ? { miles: s.miles } : {}),
    addedToBank: true,
  }
  const lines = [
    `${formatCurrency(earnings)} earned − ${formatCurrency(gas)} gas · ${formatShortDate(s.date)}`,
    `Net ${formatCurrency(net)} added to your bank balance.`,
  ]
  if (s.hours) lines.push(`${formatCurrency(net / s.hours)}/hr over ${s.hours}h.`)
  return {
    status: 'ok',
    understanding: {
      action: { kind: 'shift', input },
      summary: `Log a ${platform} shift — ${formatCurrency(net)} net`,
      lines,
      warning: gas === 0 ? 'No gas cost read, so net equals gross.' : undefined,
    },
  }
}

function payment(s: Scan, state: AppState, raw: string): ParseResult {
  const debts = activeDebts(state.debts)
  if (!debts.length) return { status: 'unclear', message: 'There are no active debts to pay.' }

  const sup = bySuperlative(raw, state)
  const scored = scoreByName(raw, debts)
  const best = scored[0]
  const runnerUp = scored[1]

  // A name beats a superlative only when it is genuinely distinctive.
  const named = best && best.score >= 1.4 ? best : null
  const ambiguous = named && runnerUp && runnerUp.score > named.score / 1.4

  if (!named && !sup) {
    return {
      status: 'unclear',
      message: `Which debt? Name it (e.g. "${debts[0].name}") or say "highest APR".`,
    }
  }

  const targets: { debt: Debt; why?: string }[] =
    named && ambiguous
      ? scored.filter((x) => x.score > best.score / 1.4).slice(0, 4)
      : named
        ? [{ debt: named.debt }]
        : [{ debt: sup!.debt, why: sup!.why }]

  const clearing = PAY_OFF.test(` ${raw.toLowerCase()} `) && s.money.length === 0

  const built = targets.map(({ debt, why }) => {
    const amount = s.money[0] ?? (clearing ? debt.balance : 0)
    return buildPayment(state, debt, amount, s, raw, why)
  })

  if (built.some((b) => b === null)) {
    const shown = targets[0].debt
    return {
      status: 'unclear',
      message: `How much went to ${shown.name}? It has ${formatCurrency(shown.balance)} outstanding.`,
    }
  }

  const ok = built as Understanding[]
  if (ok.length > 1) {
    return {
      status: 'choose',
      message: 'That could be more than one debt — which did you mean?',
      options: ok,
    }
  }
  return { status: 'ok', understanding: ok[0] }
}

function buildPayment(
  state: AppState,
  debt: Debt,
  amount: number,
  s: Scan,
  raw: string,
  why?: string,
): Understanding | null {
  if (!(amount > 0)) return null

  const applied = Math.min(amount, debt.balance)
  const clears = applied >= debt.balance
  // A payment matching the scheduled instalment is the regular one, so the due
  // date moves on. Anything else is extra, on top of the schedule.
  const scheduled =
    debt.monthlyPayment !== undefined && Math.abs(amount - debt.monthlyPayment) < 0.01
  const advanceDue =
    !clears && (scheduled || /\bregular\b|\bscheduled\b|\bminimum\b|\bmonthly payment\b/.test(raw.toLowerCase()))
  const advanceTo = advanceDue ? nextDueAfter(debt) : null

  const input: PaymentInput = {
    debtId: debt.id,
    amount: applied,
    date: s.date,
    fromBank: true,
    advanceDue,
  }

  const lines = [
    `${debt.name}${why ? ` — ${why}` : ''}`,
    `Balance ${formatCurrency(debt.balance)} → ${formatCurrency(debt.balance - applied)}`,
    `${formatCurrency(applied)} comes out of your bank balance (${formatCurrency(
      state.bankBalance.amount,
    )} → ${formatCurrency(state.bankBalance.amount - applied)}).`,
  ]
  if (advanceTo) lines.push(`Next due date moves to ${formatShortDate(advanceTo)}.`)
  else if (!clears) lines.push('Treated as an extra payment — the due date does not move.')
  if (clears) lines.push(`Clears ${debt.name} and moves it to the cleared log. 🎉`)

  const warning =
    // Two amounts in one sentence usually means two payments; only the first is
    // read, so say so rather than silently dropping the rest.
    s.money.length > 1
      ? `I read ${s.money.length} amounts and used the first (${formatCurrency(amount)}). Enter one payment at a time.`
      : amount > debt.balance
        ? `That is ${formatCurrency(amount - debt.balance)} more than the balance — only ${formatCurrency(applied)} will be applied.`
        : applied > state.bankBalance.amount
          ? `That is more than your bank balance, which would go to ${formatCurrency(state.bankBalance.amount - applied)}.`
          : undefined

  return {
    action: { kind: 'payment', input, debt },
    summary: `Pay ${formatCurrency(applied)} to ${debt.name}`,
    lines,
    warning,
  }
}

const LENDERS: [RegExp, DebtProduct, DebtProduct][] = [
  // [match, when there is a monthly payment, otherwise]
  [/\baffirm\b/, 'affirm_pay_monthly', 'affirm_pay_in_4'],
  [/\bpay\s?pal\b/, 'paypal_pay_monthly', 'paypal_pay_in_4'],
  [/\bklarna\b/, 'klarna_pay_in_4', 'klarna_pay_in_4'],
  [/\bafterpay\b|\bzip\b|\bsezzle\b/, 'klarna_pay_in_4', 'klarna_pay_in_4'],
  [/\bcredit card\b|\bvisa\b|\bmastercard\b|\bamex\b|\bapple card\b/, 'credit_card', 'credit_card'],
]

const NAME_FILLER =
  /\b(?:new|add|a|another|debt|loan|plan|i|owe|to|for|from|with|took|out|borrowed|financed|of|the|my|at|apr|interest|rate|and|it|is|about|around|maybe|potential|unconfirmed|payment|payments|due|starting|starts)\b/g

function newDebt(s: Scan, state: AppState, raw: string): ParseResult {
  const balance = s.money[0]
  if (balance === undefined || balance <= 0) {
    return { status: 'unclear', message: 'How much is the new debt? Try "I owe Sam 150".' }
  }

  const lender = LENDERS.find(([re]) => re.test(` ${raw.toLowerCase()} `))
  const product: DebtProduct = lender
    ? s.perMonth
      ? lender[1]
      : lender[2]
    : 'personal'

  // Whatever is left once the grammar and the figures are stripped is the name.
  const leftover = s.rest
    .replace(NAME_FILLER, ' ')
    .replace(/[^a-z0-9 ]+/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const name = leftover.length
    ? leftover
        .slice(0, 4)
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(' ')
    : lender
      ? PRODUCT_LABEL[product]
      : 'New debt'

  const apr = s.percent ?? 0
  const status: DebtStatus = /\bmaybe\b|\bpotential\b|\bnot sure\b|\bunconfirmed\b|\bmight\b/.test(
    raw.toLowerCase(),
  )
    ? 'potential'
    : 'active'

  const tier: PriorityTier =
    product === 'personal' ? 4 : product === 'credit_card' ? 3 : apr >= 20 ? 1 : 2

  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const debt: Debt = {
    id: `${base || 'debt'}_${uid().slice(0, 6)}`,
    name,
    product,
    status,
    priorityTier: tier,
    balance,
    apr,
    ...(s.perMonth ? { monthlyPayment: s.perMonth } : {}),
    nextDue: s.dateGiven ? s.date : product === 'personal' ? 'flexible' : undefined,
  }

  const lines = [
    `${PRODUCT_LABEL[product]} · ${apr > 0 ? `${apr}% APR` : '0% / none stated'}`,
    s.perMonth ? `${formatCurrency(s.perMonth)} a month` : 'No scheduled payment',
    `Filed under ${tier === 4 ? 'personal / flexible' : `tier ${tier}`}${
      s.dateGiven ? `, first due ${formatShortDate(s.date)}` : ''
    }.`,
  ]
  if (status === 'potential') lines.push('Marked unconfirmed, so it stays out of your active total.')

  const existing = state.debts.find((d) => d.name.toLowerCase() === name.toLowerCase())

  return {
    status: 'ok',
    understanding: {
      action: { kind: 'new-debt', debt },
      summary: `Add ${name} — ${formatCurrency(balance)}`,
      lines,
      warning: existing
        ? `You already have a debt called ${existing.name}. This adds a second one.`
        : undefined,
    },
  }
}

/** Shown under the box so the grammar is discoverable rather than guessed at. */
export const EXAMPLES = [
  'paid 50 toward Omio',
  'put 100 on my highest APR',
  'paid off Tokyo',
  'got paid 335',
  'doordash 120, 25 gas, 4 hours',
  'I owe Sam 150',
  'new Affirm debt 400 at 36%, 50/mo',
  'bank balance is 812',
]
