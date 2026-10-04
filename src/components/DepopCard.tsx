import { useState } from 'react'
import type { AppState, DepopItem } from '../types'
import { Card } from './Card'
import { Modal } from './Modal'
import { DepopGuide } from './DepopGuide'
import { formatCurrency } from '../lib/finance'
import { formatShortDate, today } from '../lib/schedule'
import { copyText, deliverFile } from '../lib/share'
import {
  addDepopItem,
  daysListed,
  depopCsv,
  depopFees,
  depopNet,
  listingDescription,
  listingTitle,
  priceBand,
  removeDepopItem,
  sellDepopItem,
  shopSummary,
  staleness,
  suggestedFloor,
  unsellDepopItem,
  updateDepopItem,
  type DepopInput,
} from '../lib/depop'

const inputStyle = {
  background: 'var(--surface-page)',
  borderColor: 'var(--border)',
  color: 'var(--text-primary)',
}
const labelCls = 'flex flex-col gap-1 text-xs'
const inputCls = 'rounded-lg border px-3 py-2 text-sm'
const num = (v: string) => (v.trim() === '' ? undefined : Number.isFinite(Number(v)) ? Number(v) : undefined)
const str = (n: number | undefined) => (n === undefined ? '' : String(n))

/** "listed 9 days", "listed today", or — dated ahead — "listing Oct 5". */
function listedFor(item: DepopItem, now: string): string {
  const d = daysListed(item, now)
  return d < 0 ? `listing ${formatShortDate(item.dateListed)}` : d === 0 ? 'listed today' : `listed ${d} day${d === 1 ? '' : 's'}`
}

function ItemForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: DepopItem
  onSave: (input: DepopInput) => void
  onCancel: () => void
}) {
  const [brand, setBrand] = useState(initial?.brand ?? '')
  const [item, setItem] = useState(initial?.item ?? '')
  const [size, setSize] = useState(initial?.size ?? '')
  const [color, setColor] = useState(initial?.color ?? '')
  const [material, setMaterial] = useState(initial?.material ?? '')
  const [tag, setTag] = useState(str(initial?.tagPrice))
  const [list, setList] = useState(str(initial?.listPrice))
  const [floor, setFloor] = useState(str(initial?.floorPrice))
  const [listed, setListed] = useState(initial?.dateListed ?? today())

  const tagN = num(tag)
  const listN = num(list)
  const band = tagN ? priceBand(tagN) : null
  const valid = (brand.trim() || item.trim()) && listN !== undefined && listN > 0

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSave({
          brand: brand.trim(),
          item: item.trim(),
          ...(size.trim() ? { size: size.trim() } : {}),
          ...(color.trim() ? { color: color.trim() } : {}),
          ...(material.trim() ? { material: material.trim() } : {}),
          ...(tagN !== undefined ? { tagPrice: tagN } : {}),
          listPrice: listN!,
          ...(num(floor) !== undefined ? { floorPrice: num(floor) } : {}),
          dateListed: listed,
        })
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
          Brand
          <input autoFocus value={brand} placeholder="Free People" onChange={(e) => setBrand(e.target.value)} className={inputCls} style={inputStyle} />
        </label>
        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
          Item
          <input value={item} placeholder="floral midi dress" onChange={(e) => setItem(e.target.value)} className={inputCls} style={inputStyle} />
        </label>
        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
          Size
          <input value={size} placeholder="M" onChange={(e) => setSize(e.target.value)} className={inputCls} style={inputStyle} />
        </label>
        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
          Color
          <input value={color} onChange={(e) => setColor(e.target.value)} className={inputCls} style={inputStyle} />
        </label>
        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
          Material
          <input value={material} onChange={(e) => setMaterial(e.target.value)} className={inputCls} style={inputStyle} />
        </label>
        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
          Tag price ($)
          <input type="number" inputMode="decimal" step="0.01" value={tag} onChange={(e) => setTag(e.target.value)} className={inputCls} style={inputStyle} />
        </label>
      </div>

      {band && (
        <p className="rounded-lg p-2 text-xs" style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}>
          List at <strong>{formatCurrency(band.low)}–{formatCurrency(band.high)}</strong> ({band.fromPct}–{band.toPct}% of
          tag). Trendy brands at the top of the range, unfamiliar ones at the bottom — and check eBay's
          sold listings first.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
          List ($)
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={list}
            placeholder={band ? String(Math.round((band.low + band.high) / 2)) : ''}
            onChange={(e) => setList(e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </label>
        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
          Floor ($)
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={floor}
            placeholder={listN ? String(suggestedFloor(listN)) : ''}
            onChange={(e) => setFloor(e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </label>
        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
          Listed
          <input type="date" value={listed} onChange={(e) => setListed(e.target.value)} className={inputCls} style={inputStyle} />
        </label>
      </div>
      <p className="-mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        List about 15% above your lowest acceptable price, and note that floor so offers are easy calls.
        {listN ? ` At ${formatCurrency(listN)} you'd keep ${formatCurrency(depopNet(listN))} before shipping.` : ''}
      </p>

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-lg py-2 text-sm font-medium" style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}>
          Cancel
        </button>
        <button type="submit" disabled={!valid} className="flex-1 rounded-lg py-2 text-sm font-medium disabled:opacity-40" style={{ background: 'var(--cat-installment)', color: 'white' }}>
          {initial ? 'Save' : 'List it'}
        </button>
      </div>
    </form>
  )
}

function SellForm({
  item,
  onSell,
  onCancel,
}: {
  item: DepopItem
  onSell: (sale: { salePrice: number; buyerShipping?: number; shippingPaid?: number; dateSold: string; addedToBank: boolean }) => void
  onCancel: () => void
}) {
  const [price, setPrice] = useState(str(item.listPrice))
  const [buyerShip, setBuyerShip] = useState('')
  const [shipPaid, setShipPaid] = useState('')
  const [date, setDate] = useState(today())
  const [bank, setBank] = useState(true)
  const p = num(price) ?? 0
  const fees = p > 0 ? depopFees(p, num(buyerShip)) : 0
  const net = p > 0 ? depopNet(p, num(buyerShip), num(shipPaid)) : 0
  const underFloor = item.floorPrice !== undefined && p > 0 && p < item.floorPrice
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!(p > 0)) return
        onSell({ salePrice: p, buyerShipping: num(buyerShip), shippingPaid: num(shipPaid), dateSold: date, addedToBank: bank })
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
          Sold for ($)
          <input autoFocus type="number" inputMode="decimal" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} style={inputStyle} />
        </label>
        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
          Date sold
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} style={inputStyle} />
        </label>
        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
          Shipping the buyer paid ($)
          <input type="number" inputMode="decimal" step="0.01" value={buyerShip} placeholder="0" onChange={(e) => setBuyerShip(e.target.value)} className={inputCls} style={inputStyle} />
        </label>
        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
          Shipping you paid ($)
          <input type="number" inputMode="decimal" step="0.01" value={shipPaid} placeholder="0" onChange={(e) => setShipPaid(e.target.value)} className={inputCls} style={inputStyle} />
        </label>
      </div>
      {underFloor && (
        <p className="text-xs" style={{ color: 'var(--status-warning)' }}>
          Below your {formatCurrency(item.floorPrice!)} floor.
        </p>
      )}
      {p > 0 && (
        <div className="rounded-lg p-2 text-xs" style={{ background: 'var(--surface-page)' }}>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>Fees (3.3% of the buyer's total + $0.45)</span>
            <span className="tabular-nums">−{formatCurrency(fees)}</span>
          </div>
          <div className="mt-1 flex justify-between font-semibold">
            <span>Net</span>
            <span className="tabular-nums" style={{ color: 'var(--status-good)' }}>
              {formatCurrency(net)}
            </span>
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={bank} onChange={(e) => setBank(e.target.checked)} />
        Add the net to my bank balance
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-lg py-2 text-sm font-medium" style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}>
          Cancel
        </button>
        <button type="submit" disabled={!(p > 0)} className="flex-1 rounded-lg py-2 text-sm font-medium disabled:opacity-40" style={{ background: 'var(--status-good)', color: 'white' }}>
          Mark sold
        </button>
      </div>
    </form>
  )
}

/**
 * The Depop shop: what is listed, what sold, and what it put in your pocket,
 * with the plan's pricing, fees and listing template built in.
 */
export function DepopCard({
  state,
  setState,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}) {
  const now = today()
  const items = state.depopItems ?? []
  const [editing, setEditing] = useState<DepopItem | 'new' | null>(null)
  const [selling, setSelling] = useState<DepopItem | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const sum = shopSummary(items, now)
  const live = items.filter((i) => !i.dateSold).sort((a, b) => a.dateListed.localeCompare(b.dateListed))
  const sold = items.filter((i) => i.dateSold).sort((a, b) => b.dateSold!.localeCompare(a.dateSold!))
  const current = editing && editing !== 'new' ? items.find((i) => i.id === editing.id) ?? null : null

  function open(target: DepopItem | 'new' | null) {
    setEditing(target)
    setConfirmDelete(false)
    setNote(null)
  }

  async function exportSheet() {
    const how = await deliverFile(`depop-${now}.csv`, depopCsv(items), 'text/csv')
    if (how !== 'cancelled') setNote(how === 'shared' ? 'Sent to the share sheet.' : 'Downloaded.')
  }

  const row = (i: DepopItem) => {
    const stale = staleness(i, now)
    return (
      <button
        key={i.id}
        type="button"
        onClick={() => open(i)}
        className="flex w-full items-start justify-between gap-2 py-2 text-left text-sm first:pt-0 last:pb-0"
        data-depop={i.id}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {[i.brand, i.item].filter(Boolean).join(' ')}
            {i.size && <span style={{ color: 'var(--text-muted)' }}> · {i.size}</span>}
          </span>
          <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {i.id} ·{' '}
            {i.dateSold
              ? `sold ${formatShortDate(i.dateSold)} for ${formatCurrency(i.salePrice ?? 0)}`
              : `${listedFor(i, now)}${i.floorPrice !== undefined ? ` · floor ${formatCurrency(i.floorPrice)}` : ''}`}
          </span>
          {stale !== 'fresh' && (
            <span className="block text-[11px] font-medium" style={{ color: 'var(--status-warning)' }}>
              {stale === 'refresh' ? '14 days — new cover photo, then 10% off' : '30 days unsold — bundle it, or move it to Facebook Marketplace'}
            </span>
          )}
        </span>
        <span className="shrink-0 text-right tabular-nums">
          {i.dateSold ? (
            <span style={{ color: 'var(--status-good)' }}>{formatCurrency(i.net ?? 0)}</span>
          ) : (
            formatCurrency(i.listPrice)
          )}
        </span>
      </button>
    )
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Depop shop
        </h2>
        <button
          type="button"
          onClick={() => open('new')}
          className="rounded-lg px-3 py-1.5 text-xs font-medium"
          style={{ background: 'var(--cat-installment)', color: 'white' }}
        >
          + List item
        </button>
      </div>

      {items.length === 0 ? (
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Nothing listed yet. The plan's first step: photograph and list your first 10 items, the
          new-with-tags pile first.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {sum.listed} listed · {formatCurrency(sum.onShelf)} on the shelf · {sum.sold} sold ·{' '}
            <span style={{ color: 'var(--status-good)' }}>{formatCurrency(sum.net)} net</span>
          </p>
          {(sum.refresh > 0 || sum.move > 0) && (
            <p className="mt-1 text-xs" style={{ color: 'var(--status-warning)' }}>
              {[sum.refresh > 0 && `${sum.refresh} need a new cover and 10% off`, sum.move > 0 && `${sum.move} to bundle or move to Marketplace`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {live.length > 0 && (
            <div className="mt-2 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
              {live.map(row)}
            </div>
          )}
          {sold.length > 0 && (
            <>
              <h3 className="mt-3 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Sold
              </h3>
              <div className="mt-1 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
                {sold.map(row)}
              </div>
            </>
          )}
          <button
            type="button"
            onClick={() => void exportSheet()}
            className="mt-3 w-full rounded-lg py-1.5 text-xs font-medium"
            style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}
          >
            Export the tracking sheet (CSV)
          </button>
          {note && !editing && (
            <p className="mt-1 text-[11px]" style={{ color: 'var(--status-good)' }}>
              {note}
            </p>
          )}
        </>
      )}

      <DepopGuide />

      {editing && (
        <Modal title={editing === 'new' ? 'List an item' : `${current?.id ?? ''} · Edit`} onClose={() => open(null)}>
          <ItemForm
            initial={current ?? undefined}
            onSave={(input) => {
              setState((s) => (current ? updateDepopItem(s, current.id, input) : addDepopItem(s, input)))
              open(null)
            }}
            onCancel={() => open(null)}
          />
          {current && (
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyText(`${listingTitle(current)}\n\n${listingDescription(current)}`)
                  setNote(ok ? 'Title and description copied — fill the brackets in Depop.' : 'The browser refused the copy.')
                }}
                className="rounded-lg py-2 text-sm font-medium"
                style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}
              >
                Copy title and description
              </button>
              {note && (
                <p className="text-[11px]" style={{ color: 'var(--status-good)' }}>
                  {note}
                </p>
              )}
              {current.dateSold ? (
                <button
                  type="button"
                  onClick={() => {
                    setState((s) => unsellDepopItem(s, current.id))
                    open(null)
                  }}
                  className="rounded-lg py-2 text-sm font-medium"
                  style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}
                >
                  Undo the sale{current.addedToBank ? ` (takes ${formatCurrency(current.net ?? 0)} back out of the bank)` : ''}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSelling(current)
                    open(null)
                  }}
                  className="rounded-lg py-2 text-sm font-medium"
                  style={{ background: 'var(--status-good)', color: 'white' }}
                >
                  Mark sold
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!confirmDelete) return setConfirmDelete(true)
                  setState((s) => removeDepopItem(s, current.id))
                  open(null)
                }}
                className="rounded-lg py-2 text-sm font-medium"
                style={{
                  background: confirmDelete ? 'var(--status-critical)' : 'transparent',
                  color: confirmDelete ? 'white' : 'var(--status-critical)',
                }}
              >
                {confirmDelete ? 'Delete for good' : 'Delete item'}
              </button>
            </div>
          )}
        </Modal>
      )}

      {selling && (
        <Modal title={`Sold · ${[selling.brand, selling.item].filter(Boolean).join(' ')}`} onClose={() => setSelling(null)}>
          <SellForm
            item={selling}
            onSell={(sale) => {
              setState((s) => sellDepopItem(s, selling.id, sale))
              setSelling(null)
            }}
            onCancel={() => setSelling(null)}
          />
        </Modal>
      )}
    </Card>
  )
}
