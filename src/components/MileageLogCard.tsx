import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Shift } from '../types'
import { Card } from './Card'
import { formatCurrency } from '../lib/finance'
import { formatRate } from '../lib/gig'
import { mileageCsv, mileageLog, mileageTotals, type MileageRow } from '../lib/mileageLog'
import { deliverFile } from '../lib/share'
import { formatShortDate, today } from '../lib/schedule'

const muted = { color: 'var(--text-muted)' }
const secondary = { color: 'var(--text-secondary)' }
const miles = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 })

/** "Jan 4 – Jun 28" for one rate's stretch of the year. */
function span(from: string, to: string) {
  return from === to ? formatShortDate(from) : `${formatShortDate(from)} – ${formatShortDate(to)}`
}

/**
 * The year's mileage log: how much of it would stand up, what it is worth,
 * and the log itself to hand over — as a spreadsheet, or printed to PDF.
 */
export function MileageLogCard({ shifts, vehicle }: { shifts: Shift[]; vehicle?: string }) {
  const year = today().slice(0, 4)
  const rows = mileageLog(shifts, year)
  const t = mileageTotals(rows)
  const [viewing, setViewing] = useState(false)
  const [saved, setSaved] = useState('')
  if (rows.length === 0) return null

  const odometer = rows.filter((r) => r.source === 'odometer').length
  const tripMeter = rows.filter((r) => r.source === 'trip meter').length
  const estimates = rows.filter((r) => r.source === 'estimate').length
  const noArea = rows.filter((r) => r.businessMiles > 0 && !r.area).length

  async function saveCsv() {
    const how = await deliverFile(`mileage-log-${year}.csv`, mileageCsv(rows), 'text/csv')
    setSaved(how === 'cancelled' ? '' : how === 'shared' ? 'Shared.' : 'Saved to Downloads.')
  }

  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold" style={secondary}>
          Mileage log · {year}
        </h3>
        <span className="text-[11px]" style={muted}>
          {rows.length} shift{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm">{miles(t.businessMiles)} business miles</span>
        <strong className="tabular-nums text-sm" style={{ color: 'var(--status-good)' }}>
          {formatCurrency(t.deduction)}
        </strong>
      </div>
      {t.periods.map((p) => (
        <div key={p.rate} className="flex items-baseline justify-between gap-3 text-xs" style={muted}>
          <span>
            {miles(p.miles)} mi × {formatRate(p.rate)} · {span(p.from, p.to)}
          </span>
          <span className="tabular-nums">{formatCurrency(p.deduction)}</span>
        </div>
      ))}

      {/* How well the log would hold up, strongest record first. */}
      <ul className="mt-2 flex flex-col gap-0.5 text-[11px]" style={muted}>
        {odometer > 0 && <li>✓ {odometer} with odometer readings — the strongest record</li>}
        {tripMeter > 0 && <li>✓ {tripMeter} from the trip meter</li>}
        {estimates > 0 && (
          <li style={{ color: 'var(--status-warning)' }}>
            ⚠ {estimates} estimated from the range display ({miles(t.estimatedMiles)} mi). Fine for
            knowing what a shift made, weak for the IRS — note the odometer at the start and end of
            each dash instead.
          </li>
        )}
        {t.missingMiles > 0 && (
          <li style={{ color: 'var(--status-warning)' }}>
            ⚠ {t.missingMiles} with no miles at all, so they claim nothing.
          </li>
        )}
        {noArea > 0 && <li>{noArea} without a "where" — add one when you edit the shift.</li>}
        {t.w2Miles > 0 && <li>{miles(t.w2Miles)} mi of W-2 work left out — employees can't deduct them.</li>}
      </ul>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={saveCsv}
          className="rounded-lg py-2 text-sm font-medium"
          style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}
        >
          Save CSV
        </button>
        <button
          type="button"
          onClick={() => setViewing(true)}
          className="rounded-lg py-2 text-sm font-medium"
          style={{ background: 'var(--cat-installment)', color: 'white' }}
        >
          View / print log
        </button>
      </div>
      {saved && (
        <p className="mt-1 text-[11px]" style={muted}>
          {saved}
        </p>
      )}
      <p className="mt-2 text-[11px]" style={muted}>
        Only 1099 driving counts. Commuting to FedEx or any W-2 job isn't deductible, so it isn't
        logged here. Claim this mileage or your gas, not both — the rate already covers fuel.
      </p>

      {viewing && createPortal(
          <PrintableLog year={year} rows={rows} vehicle={vehicle} onClose={() => setViewing(false)} />,
          document.body,
        )}
    </Card>
  )
}

/**
 * A plain black-on-white page that prints as the log, whatever the app's
 * theme. Rendered outside the app's root so the print stylesheet can hide
 * everything else.
 */
function PrintableLog({
  year,
  rows,
  vehicle,
  onClose,
}: {
  year: string
  rows: MileageRow[]
  vehicle?: string
  onClose: () => void
}) {
  const t = mileageTotals(rows)
  const cellCls = 'border border-neutral-300 px-1.5 py-1 align-top'
  return (
    <div
      className="mileage-print fixed inset-0 z-30 overflow-y-auto bg-white p-4 text-black"
      role="dialog"
      aria-modal="true"
      aria-label={`Mileage log ${year}`}
    >
      <div className="no-print mb-3 flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-neutral-300 py-2 text-sm">
          Close
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex-1 rounded-lg bg-black py-2 text-sm font-medium text-white"
        >
          Print / Save as PDF
        </button>
      </div>

      <h1 className="text-lg font-semibold">Business mileage log — {year}</h1>
      <p className="text-xs">{vehicle ? `Vehicle: ${vehicle} · ` : ''}Standard mileage rate · Generated {formatShortDate(today())}</p>

      {/* Eight columns do not fit a phone, so the table scrolls on screen; on
          paper it has the width it needs. */}
      <div className="mileage-table mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[10px] leading-tight">
          <thead>
            <tr className="bg-neutral-100 text-left">
              <th className={cellCls}>Date</th>
              <th className={cellCls}>Business purpose</th>
              <th className={cellCls}>Where</th>
              <th className={cellCls}>Odometer</th>
              <th className={`${cellCls} text-right`}>Miles</th>
              <th className={cellCls}>Source</th>
              <th className={`${cellCls} text-right`}>Rate</th>
              <th className={`${cellCls} text-right`}>Deduction</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className={`${cellCls} whitespace-nowrap`}>{r.date}</td>
                <td className={cellCls}>{r.purpose}</td>
                <td className={cellCls}>{r.area || '—'}</td>
                <td className={`${cellCls} whitespace-nowrap tabular-nums`}>
                  {r.odometerStart && r.odometerEnd ? `${r.odometerStart} → ${r.odometerEnd}` : '—'}
                </td>
                <td className={`${cellCls} text-right tabular-nums`}>{r.miles ? miles(r.miles) : '—'}</td>
                <td className={cellCls}>{r.source}</td>
                <td className={`${cellCls} text-right tabular-nums`}>{r.businessMiles ? formatRate(r.rate) : '—'}</td>
                <td className={`${cellCls} text-right tabular-nums`}>
                  {r.businessMiles ? formatCurrency(r.deduction) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className={cellCls} colSpan={4}>
                Total · {miles(t.businessMiles)} business miles
              </td>
              <td className={`${cellCls} text-right tabular-nums`}>{miles(t.miles)}</td>
              <td className={cellCls} colSpan={2} />
              <td className={`${cellCls} text-right tabular-nums`}>{formatCurrency(t.deduction)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3 text-[11px]">
        {t.periods.map((p) => (
          <p key={p.rate}>
            {miles(p.miles)} mi × {formatRate(p.rate)} ({span(p.from, p.to)}) = {formatCurrency(p.deduction)}
          </p>
        ))}
        <p className="mt-2">
          Rates: IRS business standard mileage rate — 2026: 72.5¢ through June 30 (IR-2025-128), 76¢ from
          July 1 (IR-2026-29). W-2 work is listed for completeness and not counted. Commuting is not included.
        </p>
      </div>
    </div>
  )
}
