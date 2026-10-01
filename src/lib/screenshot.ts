import type { AppState, Debt } from '../types'
import { activeDebts } from './finance'
import { addDays, isDate, today } from './schedule'

/**
 * Turns the words read off a screenshot of a bank or lender app into figures,
 * and the figures into proposed changes.
 *
 * Nothing here knows about OCR. It takes words with their positions, which is
 * what any reader produces, so it can be tested against real screenshots
 * without a browser.
 *
 * Positions matter more than reading order. Apps lay a figure out next to its
 * label in different ways: PayPal on the same row ("Remaining  $526.87"),
 * Affirm underneath ("Remaining" over "$267.25"), Klarna and PNC above
 * ("$90.68" over "Left to pay"). The OCR's own grouping of words into lines
 * changes with its settings, so rows are rebuilt here from the geometry.
 */

export interface OcrWord {
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface OcrPage {
  width: number
  height: number
  words: OcrWord[]
}

export type ScreenKind = 'bank' | 'affirm' | 'klarna' | 'paypal' | 'unknown'

/** What one screenshot says, before it is matched to anything. */
export interface Reading {
  kind: ScreenKind
  /** The merchant, plan or account the screen is about, as printed. */
  title: string
  /** Remaining on a loan; available balance on a bank account. */
  balance?: number
  /** ISO date of the next payment. */
  nextDue?: string
  nextAmount?: number
  paymentsLeft?: number
  /** The whole page, lower-cased, for matching names against. */
  text: string
}

interface Row {
  words: OcrWord[]
  text: string
  y0: number
  y1: number
}

const mid = (a: number, b: number) => (a + b) / 2

/**
 * Words whose vertical centres fall inside the same word's height share a row.
 * Measured against the row's first word, not a range that grows — a growing
 * range lets one tall word chain two separate rows together.
 */
export function toRows(words: OcrWord[]): Row[] {
  const sorted = words.filter((w) => w.text.trim()).sort((a, b) => mid(a.y0, a.y1) - mid(b.y0, b.y1))
  const rows: { anchor: OcrWord; words: OcrWord[] }[] = []
  for (const w of sorted) {
    const c = mid(w.y0, w.y1)
    const row = rows.find((r) => c >= r.anchor.y0 && c <= r.anchor.y1)
    if (row) row.words.push(w)
    else rows.push({ anchor: w, words: [w] })
  }
  return rows
    .map((r) => {
      const ws = r.words.sort((a, b) => a.x0 - b.x0)
      return {
        words: ws,
        text: ws.map((w) => w.text).join(' '),
        y0: Math.min(...ws.map((w) => w.y0)),
        y1: Math.max(...ws.map((w) => w.y1)),
      }
    })
    .sort((a, b) => a.y0 - b.y0)
}

// ── money ────────────────────────────────────────────────────────────────

/**
 * A dollar amount with cents. Cents are required: "$2000" is as likely a
 * dropped decimal point as two thousand dollars, and a wrong balance is worse
 * than none. The dollar sign is often read as £ or S, so those are allowed.
 */
const MONEY = /^([-–—]?)[$£S]?(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2})$/

export function parseMoney(text: string): number | null {
  const t = text.replace(/^[([{|"'“]+/, '').replace(/[)\]}|>»"'”]+$/, '')
  const m = MONEY.exec(t)
  if (!m) return null
  const n = Number(`${m[2].replace(/,/g, '')}.${m[3]}`)
  return m[1] ? -n : n
}

/** Money on a word, counting a lone minus sign just before it. */
function moneyAt(row: Row, i: number): number | null {
  const v = parseMoney(row.words[i].text)
  if (v === null) return null
  const prev = row.words[i - 1]
  if (v > 0 && prev && /^[-–—]$/.test(prev.text) && row.words[i].x0 - prev.x1 < (row.words[i].y1 - row.words[i].y0) * 1.5) {
    return -v
  }
  return v
}

function moneyIn(row: Row): { value: number; word: OcrWord }[] {
  const out: { value: number; word: OcrWord }[] = []
  row.words.forEach((w, i) => {
    const value = moneyAt(row, i)
    if (value !== null) out.push({ value, word: w })
  })
  return out
}

/** The words of a row that a match on its text covers. */
function wordsOf(row: Row, re: RegExp): OcrWord[] | null {
  const m = re.exec(row.text)
  if (!m) return null
  const start = m.index
  const end = start + m[0].length
  const hit: OcrWord[] = []
  let at = 0
  for (const w of row.words) {
    const from = at
    const to = at + w.text.length
    if (to > start && from < end) hit.push(w)
    at = to + 1
  }
  return hit.length ? hit : null
}

type Direction = 'right' | 'above' | 'below'

/**
 * The amount printed beside a label. Above and below look at the nearest row
 * holding money within a few line-heights, and take the amount whose centre is
 * closest to the label's — the label decides the column.
 */
export function valueNear(rows: Row[], label: RegExp, dir: Direction): number | undefined {
  for (const row of rows) {
    const lw = wordsOf(row, label)
    if (!lw) continue
    const lx0 = Math.min(...lw.map((w) => w.x0))
    const lx1 = Math.max(...lw.map((w) => w.x1))
    const lh = Math.max(...lw.map((w) => w.y1 - w.y0))
    const lc = mid(lx0, lx1)

    if (dir === 'right') {
      const right = moneyIn(row).filter((m) => m.word.x0 >= lx1 - lh)
      if (right.length) return right.sort((a, b) => a.word.x0 - b.word.x0)[0].value
      continue
    }

    const near = rows
      .filter((r) => (dir === 'above' ? r.y1 <= row.y0 + lh * 0.3 : r.y0 >= row.y1 - lh * 0.3))
      .filter((r) => (dir === 'above' ? row.y0 - r.y1 : r.y0 - row.y1) <= lh * 4)
      .sort((a, b) => (dir === 'above' ? b.y0 - a.y0 : a.y0 - b.y0))
    for (const r of near) {
      const money = moneyIn(r)
      if (!money.length) continue
      const best = money.sort(
        (a, b) => Math.abs(mid(a.word.x0, a.word.x1) - lc) - Math.abs(mid(b.word.x0, b.word.x1) - lc),
      )[0]
      // Too far across to belong to this label: a value in another column.
      if (Math.abs(mid(best.word.x0, best.word.x1) - lc) > Math.max(lx1 - lx0, best.word.x1 - best.word.x0)) break
      return best.value
    }
  }
  return undefined
}

// ── dates ────────────────────────────────────────────────────────────────

const MONTH: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

const DATE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b(?:,?\s*(20\d\d)\b)?/i

/**
 * "Oct 3", "October 10", "Jan 3, 2027" as an ISO date. Without a year it is
 * the nearest one that is not more than two months gone — lender screens show
 * the recent past and the coming year, never last year's payments as due.
 */
export function parseDate(text: string, now = today()): string | null {
  const m = DATE.exec(text)
  if (!m) return null
  const month = MONTH[m[1].toLowerCase().slice(0, 3)]
  const day = Number(m[2])
  const iso = (y: number) => `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  let year = m[3] ? Number(m[3]) : Number(now.slice(0, 4))
  // Feb 30 and the like: a misread, not a date.
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCMonth() !== month - 1) return null
  if (!m[3] && iso(year) < addDays(now, -60)) year += 1
  return iso(year)
}

// ── reading a page ───────────────────────────────────────────────────────

export function detectKind(text: string): ScreenKind {
  const t = text.toLowerCase()
  if (/available balance|ledger balance|current balance/.test(t)) return 'bank'
  if (/left to pay|choose how to pay|klarna/.test(t)) return 'klarna'
  if (/plan timeline|autopay:|payments? left|paid to date/.test(t)) return 'affirm'
  if (/pay monthly|you.ve paid|payment schedule|scheduled for/.test(t)) return 'paypal'
  return 'unknown'
}

/** Rows that are status-bar clutter or app chrome rather than content. */
function isChrome(row: Row, page: OcrPage): boolean {
  return row.y1 < page.height * 0.06 || row.y0 > page.height * 0.93
}

const LABEL = /remaining|paid|balance|schedule|autopay|payment|pay monthly|pay in 4|payin4|details|timeline|choose|left/i

/**
 * The name of what the screen is about: the largest text in the top half that
 * is neither a figure nor a label. On Affirm the line under it — the hotel,
 * under "Hotels.com" — is what tells two plans from the same merchant apart.
 */
function titleOf(rows: Row[], page: OcrPage): string {
  const candidates = rows.filter(
    (r) =>
      !isChrome(r, page) &&
      r.y0 < page.height * 0.5 &&
      moneyIn(r).length === 0 &&
      /[a-z]{3}/i.test(r.text) &&
      !LABEL.test(r.text),
  )
  if (!candidates.length) return ''
  const height = (r: Row) => Math.max(...r.words.map((w) => w.y1 - w.y0))
  const top = [...candidates].sort((a, b) => height(b) - height(a))[0]
  const next = candidates.find((r) => r.y0 > top.y1 && r.y0 - top.y1 < height(top) * 2.5)
  const clean = (s: string) => s.replace(/[>›]+$/, '').trim()
  return next ? `${clean(top.text)} · ${clean(next.text)}` : clean(top.text)
}

export function readPage(page: OcrPage, now = today()): Reading {
  const rows = toRows(page.words)
  const text = rows.map((r) => r.text).join('\n')
  const kind = detectKind(text)
  const reading: Reading = { kind, title: titleOf(rows, page), text: text.toLowerCase() }

  if (kind === 'bank') {
    reading.balance =
      valueNear(rows, /available\s+balance/i, 'above') ??
      valueNear(rows, /available\s+balance/i, 'right') ??
      valueNear(rows, /available\s+balance/i, 'below') ??
      valueNear(rows, /current\s+balance/i, 'above') ??
      valueNear(rows, /current\s+balance/i, 'right')
    const account = rows.find((r) => /checking|savings/i.test(r.text))
    if (account) reading.title = account.text.trim()
  }

  if (kind === 'paypal') {
    reading.balance = valueNear(rows, /remaining/i, 'right') ?? valueNear(rows, /remaining/i, 'below')
    const scheduled = rows.find((r) => /scheduled for/i.test(r.text) && parseDate(r.text, now))
    const listed = rows.find((r) => /\bon\b/i.test(r.text) && parseDate(r.text, now) && moneyIn(r).length)
    const row = scheduled ?? listed
    if (row) {
      reading.nextDue = parseDate(row.text, now) ?? undefined
      reading.nextAmount = moneyIn(row)[0]?.value
    }
  }

  if (kind === 'klarna') {
    reading.balance =
      valueNear(rows, /left\s+to\s+pay/i, 'above') ??
      valueNear(rows, /left\s+to\s+pay/i, 'below') ??
      valueNear(rows, /left\s+to\s+pay/i, 'right')
    // The next payment sits in a date box: the month over the day, beside its
    // amount ("Oct  $90.68" over "10  Autopay in 10 days"). It is the one
    // reliable source. The timeline below lists every instalment with no
    // year and marks the paid ones only with a tick the reader cannot see, so
    // on the day one is paid it still looks due.
    const box = rows.findIndex(
      (r, i) =>
        /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(r.text) &&
        /^\d{1,2}\b/.test(rows[i + 1]?.text ?? '') &&
        rows[i + 1].y0 - r.y1 < (r.y1 - r.y0) * 1.5,
    )
    const boxDate = box >= 0 ? parseDate(`${rows[box].text.split(/\s/)[0]} ${rows[box + 1].text.split(/\s/)[0]}`, now) : null
    if (boxDate) {
      reading.nextDue = boxDate
      reading.nextAmount = moneyIn(rows[box])[0]?.value
    } else {
      // Without the box, the unpaid instalments are the last ones on the
      // timeline: as many as what is left to pay holds of the usual amount.
      // The reader drops an amount here and there, so the usual one is taken
      // from those it did get. The purchase line carries a time of day and is
      // not an instalment.
      const dated: { date: string; amount?: number }[] = []
      for (const r of rows) {
        if (isChrome(r, page) || /\d:\d\d/.test(r.text)) continue
        const date = parseDate(r.text, now)
        if (date) dated.push({ date, amount: moneyIn(r)[0]?.value })
      }
      dated.sort((a, b) => a.date.localeCompare(b.date))
      const amounts = dated.flatMap((x) => (x.amount && x.amount > 0 ? [x.amount] : [])).sort((a, b) => a - b)
      const usual = amounts[Math.floor(amounts.length / 2)]
      const unpaid = reading.balance !== undefined && usual ? Math.round(reading.balance / usual) : 0
      const first = unpaid >= 1 && unpaid <= dated.length ? dated[dated.length - unpaid] : undefined
      const upcoming = first ?? dated.find((x) => x.date >= now)
      if (upcoming) {
        reading.nextDue = upcoming.date
        reading.nextAmount = upcoming.amount ?? (first ? usual : undefined)
      }
    }
  }

  if (kind === 'affirm') {
    reading.balance = valueNear(rows, /remaining/i, 'below') ?? valueNear(rows, /remaining/i, 'right')
    // Upcoming instalments read "AutoPay: Oct 3", or "Due: Oct 3" with
    // AutoPay off. "AutoPay: ON" has no date and is passed over.
    const next = rows.find((r) => /\b(autopay|due|upcoming)\b\s*:?/i.test(r.text) && parseDate(r.text, now))
    if (next) {
      reading.nextDue = parseDate(next.text, now) ?? undefined
      reading.nextAmount = moneyIn(next)[0]?.value
    }
    const left = /(\d+)\s+payments?\s+left/i.exec(text)
    if (left) reading.paymentsLeft = Number(left[1])
  }

  return reading
}

// ── matching a reading to a debt ─────────────────────────────────────────

const LENDER_OF: Record<Exclude<ScreenKind, 'bank' | 'unknown'>, (d: Debt) => boolean> = {
  affirm: (d) => d.product.startsWith('affirm'),
  // The Amazon plan was first recorded under its own product; it is Klarna's.
  klarna: (d) => d.product.startsWith('klarna') || d.product === 'amazon_pay_in_4',
  paypal: (d) => d.product.startsWith('paypal'),
}

/** Words in a debt's name too common to tell one plan from another. */
const COMMON = new Set([
  'affirm', 'klarna', 'paypal', 'pay', 'monthly', 'the', 'and', 'new', 'large', 'small', 'plan', 'loan', 'cousin',
])

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !COMMON.has(t))
}

const near = (a: number | undefined, b: number | undefined, tol: number) =>
  a !== undefined && b !== undefined && Math.abs(a - b) <= tol

/**
 * How well a debt fits a screen. Its name carries the most weight; the
 * figures settle a tie — two Klarna plans from ACE share every word of the
 * merchant's name, and only the amounts tell them apart.
 */
export function matchScore(debt: Debt, r: Reading): number {
  const words = new Set(r.text.split(/[^a-z0-9]+/))
  const named = nameTokens(debt.name).filter((t) => words.has(t)).length
  let score = named * 3
  if (near(r.nextAmount, debt.monthlyPayment, 0.01)) score += 2
  if (near(r.balance, debt.balance, 0.5)) score += 2
  else if (r.balance !== undefined && debt.monthlyPayment && near(r.balance, debt.balance, debt.monthlyPayment * 1.05)) score += 1
  return score
}

export interface Proposal {
  kind: 'bank' | 'debt'
  /** Indexes of the screenshots this came from. */
  sources: number[]
  title: string
  lender: ScreenKind
  /** Best match; absent when nothing fitted. */
  debtId?: string
  /** Every plan from the same lender, to choose from when the match is wrong. */
  candidates: { id: string; name: string }[]
  /** Only one debt fitted, and by more than its figures. */
  confident: boolean
  balance?: number
  nextDue?: string
  nextAmount?: number
}

/**
 * One proposal per account or plan. Two screenshots of the same Affirm plan —
 * the top with the balance, scrolled down for the dates — become one.
 */
export function propose(readings: Reading[], state: AppState): { proposals: Proposal[]; unread: number[] } {
  const proposals: Proposal[] = []
  const unread: number[] = []
  const debts = activeDebts(state.debts)

  readings.forEach((r, i) => {
    if (r.kind === 'unknown' || (r.balance === undefined && !r.nextDue)) {
      unread.push(i)
      return
    }
    if (r.kind === 'bank') {
      const same = proposals.find((p) => p.kind === 'bank')
      if (same) {
        same.sources.push(i)
        same.balance ??= r.balance
      } else {
        proposals.push({
          kind: 'bank', sources: [i], title: r.title || 'Bank account', lender: 'bank',
          candidates: [], confident: r.balance !== undefined, balance: r.balance,
        })
      }
      return
    }

    const pool = debts.filter(LENDER_OF[r.kind])
    const scored = pool.map((d) => ({ d, s: matchScore(d, r) })).sort((a, b) => b.s - a.s)
    const top = scored[0]
    const runnerUp = scored[1]
    const matched = top && top.s > 0 ? top.d : undefined
    const confident =
      !!matched && nameTokens(matched.name).some((t) => r.text.split(/[^a-z0-9]+/).includes(t)) && (!runnerUp || runnerUp.s < top.s)

    const existing = matched && proposals.find((p) => p.kind === 'debt' && p.debtId === matched.id)
    if (existing) {
      existing.sources.push(i)
      existing.balance ??= r.balance
      existing.nextDue ??= r.nextDue
      existing.nextAmount ??= r.nextAmount
      existing.confident ||= confident
      return
    }
    proposals.push({
      kind: 'debt',
      sources: [i],
      title: r.title,
      lender: r.kind,
      debtId: matched?.id,
      candidates: pool.map((d) => ({ id: d.id, name: d.name })),
      confident,
      balance: r.balance,
      nextDue: r.nextDue,
      nextAmount: r.nextAmount,
    })
  })
  return { proposals, unread }
}

/** What applying a proposal would change, for the review screen. */
export function changesFor(p: Proposal, state: AppState): { field: 'balance' | 'nextDue'; from?: number | string; to: number | string }[] {
  const out: { field: 'balance' | 'nextDue'; from?: number | string; to: number | string }[] = []
  if (p.kind === 'bank') {
    if (p.balance !== undefined && Math.abs(p.balance - state.bankBalance.amount) > 0.004) {
      out.push({ field: 'balance', from: state.bankBalance.amount, to: p.balance })
    }
    return out
  }
  const debt = state.debts.find((d) => d.id === p.debtId)
  if (!debt) return out
  if (p.balance !== undefined && Math.abs(p.balance - debt.balance) > 0.004) {
    out.push({ field: 'balance', from: debt.balance, to: p.balance })
  }
  if (p.nextDue && isDate(p.nextDue) && p.nextDue !== debt.nextDue) {
    out.push({ field: 'nextDue', from: debt.nextDue, to: p.nextDue })
  }
  return out
}

/**
 * Applies the accepted proposals. A bank figure replaces the balance and is
 * dated today; a loan's figures replace its balance and next due date. Nothing
 * else on the debt is touched — the payment amount, the final date and the
 * notes stay as they were.
 */
export function applyProposals(state: AppState, accepted: Proposal[], now = today()): AppState {
  let next = state
  for (const p of accepted) {
    if (p.kind === 'bank') {
      if (p.balance === undefined) continue
      next = { ...next, bankBalance: { amount: p.balance, updatedAt: now } }
      continue
    }
    next = {
      ...next,
      debts: next.debts.map((d) =>
        d.id !== p.debtId
          ? d
          : {
              ...d,
              ...(p.balance !== undefined ? { balance: Math.round(p.balance * 100) / 100 } : {}),
              ...(p.nextDue && isDate(p.nextDue) ? { nextDue: p.nextDue } : {}),
            },
      ),
    }
  }
  return next
}
