import type { AppState, DepopItem } from '../types'
import { DEPOP_PROCESSING_FLAT, DEPOP_PROCESSING_RATE } from './plan'
import { daysUntil, today } from './schedule'
import { uid } from './id'

/**
 * The Depop shop: what is listed, what sold, and what it actually put in your
 * pocket. Fees are Depop's US payment processing — 3.3% of the buyer's total,
 * shipping included, plus $0.45. There is no selling fee.
 */

const r2 = (n: number) => Math.round(n * 100) / 100

/** Processing on the buyer's total: the sale plus any shipping they paid. */
export function depopFees(salePrice: number, buyerShipping = 0): number {
  return r2((salePrice + Math.max(buyerShipping, 0)) * DEPOP_PROCESSING_RATE + DEPOP_PROCESSING_FLAT)
}

/** The sale less fees and any shipping you paid yourself. */
export function depopNet(salePrice: number, buyerShipping = 0, shippingPaid = 0): number {
  return r2(salePrice - depopFees(salePrice, buyerShipping) - Math.max(shippingPaid, 0))
}

export interface PriceBand {
  fromPct: number
  toPct: number
  low: number
  high: number
}

/**
 * Where to list a new-with-tags piece, from the plan's table:
 * $20-40 tag → 40-60%, $40-80 → 35-50%, $80+ → 30-45%. A tag under $20 takes
 * the first row's range.
 */
export function priceBand(tagPrice: number): PriceBand {
  const [fromPct, toPct] = tagPrice >= 80 ? [30, 45] : tagPrice >= 40 ? [35, 50] : [40, 60]
  return { fromPct, toPct, low: r2((tagPrice * fromPct) / 100), high: r2((tagPrice * toPct) / 100) }
}

/** List about 15% above the lowest you will take, so the floor is the list price ÷ 1.15. */
export function suggestedFloor(listPrice: number): number {
  return Math.floor(listPrice / 1.15)
}

/** The next id in the sheet's style: D001, D002, … */
export function nextItemId(items: DepopItem[]): string {
  const max = items.reduce((m, i) => Math.max(m, Number(/^D(\d+)$/.exec(i.id)?.[1] ?? 0)), 0)
  return `D${String(max + 1).padStart(3, '0')}`
}

export type Staleness = 'fresh' | 'refresh' | 'move'

/**
 * The plan's weekly routine for what has not sold: at 14 days a new cover
 * photo and 10% off, at 30 days bundle it or move it to Facebook Marketplace.
 * The app cannot see likes, so it goes by days listed.
 */
export function staleness(item: DepopItem, now = today()): Staleness {
  if (item.dateSold) return 'fresh'
  const days = -daysUntil(item.dateListed, now)
  return days >= 30 ? 'move' : days >= 14 ? 'refresh' : 'fresh'
}

export function daysListed(item: DepopItem, now = today()): number {
  return -daysUntil(item.dateListed, item.dateSold ?? now)
}

export type DepopInput = Omit<DepopItem, 'id' | 'dateSold' | 'salePrice' | 'buyerShipping' | 'fees' | 'shippingPaid' | 'net' | 'addedToBank' | 'incomeEntryId'>

export function addDepopItem(state: AppState, input: DepopInput): AppState {
  const items = state.depopItems ?? []
  return { ...state, depopItems: [...items, { ...input, id: nextItemId(items) }] }
}

export function updateDepopItem(state: AppState, id: string, input: DepopInput): AppState {
  return {
    ...state,
    depopItems: (state.depopItems ?? []).map((i) => (i.id === id ? { ...i, ...input } : i)),
  }
}

export interface Sale {
  salePrice: number
  buyerShipping?: number
  shippingPaid?: number
  dateSold: string
  addedToBank: boolean
}

/**
 * Marks an item sold and works out fees and net. Banked, the net goes into
 * the balance and the income log, like a shift — and comes back out if the
 * sale is undone.
 */
export function sellDepopItem(state: AppState, id: string, sale: Sale): AppState {
  const base = unsellDepopItem(state, id)
  const item = (base.depopItems ?? []).find((i) => i.id === id)
  if (!item || !(sale.salePrice > 0)) return state
  const fees = depopFees(sale.salePrice, sale.buyerShipping)
  const net = depopNet(sale.salePrice, sale.buyerShipping, sale.shippingPaid)
  const incomeEntryId = sale.addedToBank ? uid() : undefined
  const sold: DepopItem = {
    ...item,
    dateSold: sale.dateSold,
    salePrice: sale.salePrice,
    buyerShipping: sale.buyerShipping || undefined,
    shippingPaid: sale.shippingPaid || undefined,
    fees,
    net,
    addedToBank: sale.addedToBank,
    incomeEntryId,
  }
  return {
    ...base,
    depopItems: (base.depopItems ?? []).map((i) => (i.id === id ? sold : i)),
    ...(sale.addedToBank
      ? {
          bankBalance: { amount: r2(base.bankBalance.amount + net), updatedAt: sale.dateSold },
          incomeEntries: [
            ...base.incomeEntries,
            { id: incomeEntryId!, date: sale.dateSold, amount: net, note: `Depop — ${item.brand} ${item.item}`.trim() },
          ],
        }
      : {}),
  }
}

/** Puts a sold item back on the shelf, reversing any bank credit it made. */
export function unsellDepopItem(state: AppState, id: string): AppState {
  const item = (state.depopItems ?? []).find((i) => i.id === id)
  if (!item || !item.dateSold) return state
  const back: DepopItem = { ...item }
  for (const k of ['dateSold', 'salePrice', 'buyerShipping', 'fees', 'shippingPaid', 'net', 'addedToBank', 'incomeEntryId'] as const) {
    delete back[k]
  }
  return {
    ...state,
    depopItems: (state.depopItems ?? []).map((i) => (i.id === id ? back : i)),
    bankBalance:
      item.addedToBank && item.net !== undefined
        ? { ...state.bankBalance, amount: r2(state.bankBalance.amount - item.net) }
        : state.bankBalance,
    incomeEntries: item.incomeEntryId
      ? state.incomeEntries.filter((e) => e.id !== item.incomeEntryId)
      : state.incomeEntries,
  }
}

export function removeDepopItem(state: AppState, id: string): AppState {
  const unsold = unsellDepopItem(state, id)
  return { ...unsold, depopItems: (unsold.depopItems ?? []).filter((i) => i.id !== id) }
}

export interface ShopSummary {
  listed: number
  sold: number
  /** What sales put in your pocket, after fees and shipping. */
  net: number
  /** Asking price of everything still listed. */
  onShelf: number
  refresh: number
  move: number
}

export function shopSummary(items: DepopItem[], now = today()): ShopSummary {
  const live = items.filter((i) => !i.dateSold)
  const sold = items.filter((i) => i.dateSold)
  return {
    listed: live.length,
    sold: sold.length,
    net: r2(sold.reduce((n, i) => n + (i.net ?? 0), 0)),
    onShelf: r2(live.reduce((n, i) => n + i.listPrice, 0)),
    refresh: live.filter((i) => staleness(i, now) === 'refresh').length,
    move: live.filter((i) => staleness(i, now) === 'move').length,
  }
}

// ── listing text ─────────────────────────────────────────────────────────

/** Brand + item + key detail + size + NWT. */
export function listingTitle(item: DepopItem): string {
  return [`${item.brand} ${item.item}`.trim(), item.size ? `size ${item.size}` : '', 'NWT'].filter(Boolean).join(', ')
}

const tag = (s: string) => `#${s.toLowerCase().replace(/[^a-z0-9]+/g, '')}`

/** The plan's description template, filled in where the item says, brackets left where it doesn't. */
export function listingDescription(item: DepopItem): string {
  const money = (n: number | undefined) => (n === undefined ? '[tag price]' : Number.isInteger(n) ? String(n) : n.toFixed(2))
  return [
    `${item.brand || '[Brand]'} ${item.item || '[item]'} - new with tags (retail $${money(item.tagPrice)})`,
    `Size: ${item.size || '[size]'} | Fits: [true to size / runs small / runs big]`,
    'Measurements (flat): armpit to armpit [ ]", length [ ]"',
    `Color: ${item.color || '[color]'} | Material: ${item.material || '[fabric]'}`,
    'Condition: brand new with tags, never worn. Smoke-free home.',
    'Ships within 1-2 business days. Bundle 2+ items for 10% off.',
    [
      item.brand ? tag(item.brand) : '#[brand]',
      item.item ? tag(item.item.split(/\s+/).at(-1) ?? item.item) : '#[item]',
      '#[style]',
      item.color ? tag(item.color) : '#[color]',
      '#nwt',
    ].join(' '),
  ].join('\n')
}

// ── the tracking sheet ───────────────────────────────────────────────────

export const CSV_HEADER =
  'item_id,brand,item,tag_price,list_price,floor_price,date_listed,date_sold,sale_price,fees,shipping_paid,net'

function cell(v: string | number | undefined): string {
  if (v === undefined) return ''
  const s = typeof v === 'number' ? v.toFixed(2) : v
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** The shop as the plan's sheet, one row per item. */
export function depopCsv(items: DepopItem[]): string {
  return [
    CSV_HEADER,
    ...items.map((i) =>
      [
        i.id, i.brand, i.item, i.tagPrice, i.listPrice, i.floorPrice, i.dateListed,
        i.dateSold, i.salePrice, i.fees, i.shippingPaid, i.net,
      ].map(cell).join(','),
    ),
  ].join('\n')
}
