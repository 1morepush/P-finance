import { useState, type ReactNode } from 'react'

const muted = { color: 'var(--text-muted)' }
const secondary = { color: 'var(--text-secondary)' }

function H({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-4 text-sm font-semibold" style={secondary}>
      {children}
    </h3>
  )
}

function List({ items, ordered }: { items: ReactNode[]; ordered?: boolean }) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className={`mt-1 flex flex-col gap-1 pl-5 text-xs ${ordered ? 'list-decimal' : 'list-disc'}`}>
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </Tag>
  )
}

function Rows({ rows, head }: { rows: string[][]; head?: string[] }) {
  return (
    <table className="mt-1 w-full text-left text-xs">
      {head && (
        <thead>
          <tr style={muted}>
            {head.map((h) => (
              <th key={h} className="py-1 pr-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
            {r.map((c, j) => (
              <td key={j} className="py-1 pr-2 align-top">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const TEMPLATE = `[Brand] [item] - new with tags (retail $[tag price])
Size: [size] | Fits: [true to size / runs small / runs big]
Measurements (flat): armpit to armpit [ ]", length [ ]"
Color: [color] | Material: [fabric]
Condition: brand new with tags, never worn. Smoke-free home.
Ships within 1-2 business days. Bundle 2+ items for 10% off.
#[brand] #[item] #[style] #[color] #nwt`

/** The plan's Depop setup, pricing, shot list and listing guide, folded under the shop. */
export function DepopGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left text-xs font-medium"
        style={{ color: 'var(--cat-installment)' }}
      >
        <span>Depop guide — setup, pricing, photos, listing</span>
        <span>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="text-xs">
          <p className="mt-2" style={secondary}>
            List new-with-tags pieces at 30-60% of the tag price. On a $40 sale you keep about $38.23
            before shipping, because Depop no longer charges US sellers a selling fee.
          </p>

          <H>Set up the shop</H>
          <List
            ordered
            items={[
              'Use a clear photo of you, or a clean flat lay of your best piece, as your profile picture.',
              'Bio: "New-with-tags pieces from a family closet clean-out. Smoke-free home. Ships in 1-2 business days. Bundle 2+ for a discount."',
              'Connect your bank for Depop payouts.',
              "Use Depop's shipping labels so every order is tracked. Tracked orders pay out faster.",
              'If your settings offer a bundle or multi-buy discount, set 10% off 2+ items.',
            ]}
          />

          <H>Sort before you shoot</H>
          <List
            items={[
              'Make three piles: new with tags, like new, and worn. List the new-with-tags pile first.',
              'Check every piece for stains, pulls or storage marks, even with the tags on.',
              'Steam or lint-roll everything. Wrinkles cost sales.',
              'Shoot recognizable brands first.',
            ]}
          />

          <H>Pricing</H>
          <Rows
            head={['Tag price', 'List at', 'Example']}
            rows={[
              ['$20-40', '40-60% of tag', '$30 tag: list at $12-18'],
              ['$40-80', '35-50% of tag', '$60 tag: list at $21-30'],
              ['$80+', '30-45% of tag', '$120 tag: list at $36-54'],
            ]}
          />
          <List
            items={[
              'Price trendy brands at the top of the range and unfamiliar brands at the bottom.',
              "Check eBay's sold listings for the same brand and item before you set a price.",
              'List about 15% above your lowest acceptable price, and note that floor for each item so offers are easy calls.',
            ]}
          />

          <H>Fees and payout</H>
          <Rows
            rows={[
              ['Depop selling fee (US)', '0%'],
              ['Payment processing', "3.3% + $0.45 of the buyer's total, shipping included"],
              ['Boosted listings (optional)', '12% of boosted sales. Skip for now.'],
              ['Payout with tracking', '2 business days after delivery'],
              ['Payout without tracking', '10 business days after the sale'],
            ]}
          />
          <p className="mt-1" style={muted}>
            Source: Underpriced, Depop fees 2026, which cites Depop's help pages. Check the fee screen in
            the app before you list, since fees can change.
          </p>

          <H>Shipping</H>
          <List
            items={[
              'Let the buyer pay shipping on heavier items like jackets and shoes.',
              'Buy poly mailers at Dollar Tree or Walmart, and reuse boxes for shoes.',
              'Ship within 1-2 business days. Fast shipping earns good reviews, and reviews sell the next item.',
            ]}
          />

          <H>Shot list</H>
          <p className="mt-1" style={muted}>
            Take the same 8 photos of every item, in daylight, on the same plain background. The cover
            photo and the price-tag photo matter most.
          </p>
          <List
            items={[
              <>
                <strong>Spot:</strong> next to a window between 10am and 3pm, out of direct sun. No flash.
              </>,
              <>
                <strong>Background:</strong> a plain light wall or door for hanging shots, and a clean plain
                sheet or floor for flat lays. Use the same spot every time so the shop looks consistent.
              </>,
              <>
                <strong>Phone:</strong> wipe the lens, shoot at 1x, turn on the grid, and crop to square.
              </>,
              <>
                <strong>Gear:</strong> a plain hanger, an adhesive hook on a door, a tape measure, a lint
                roller, and a steamer or iron.
              </>,
            ]}
          />
          <Rows
            head={['#', 'Shot', 'How']}
            rows={[
              ['1', 'Cover: full front', 'Hang it on the door or lay it flat. Center it so it fills about 80% of the square.'],
              ['2', 'On body or styled', 'Worn by you or a friend (cropping out the face is fine), or styled flat with shoes or a bag.'],
              ['3', 'Full back', 'Same framing as the cover.'],
              ['4', 'Price tag', "The attached retail tag in focus, so buyers see it's new and what it originally cost."],
              ['5', 'Brand and size label', 'Close up and readable.'],
              ['6', 'Material and care label', 'Shows the fabric content buyers search for.'],
              ['7', 'Detail', 'Print, texture, buttons, zippers or hardware.'],
              ['8', 'Measurements', 'Tape across the chest from armpit to armpit, and down the length. For pants, the waist and inseam.'],
            ]}
          />
          <p className="mt-1" style={muted}>
            If an item has any flaw, swap the detail shot for a close-up of it. Showing it up front
            prevents returns.
          </p>
          <List
            items={[
              <>
                <strong>Pants and skirts:</strong> flat lay with the waistband straight; measure waist, rise and
                inseam.
              </>,
              <>
                <strong>Shoes:</strong> both sides, the soles, the size label inside, and the box if you have it.
              </>,
              <>
                <strong>Bags:</strong> the inside, the straps, a hardware close-up, and any dust bag.
              </>,
              <>
                <strong>Jackets:</strong> zipped and unzipped, the hood up if it has one, and the lining.
              </>,
            ]}
          />
          <p className="mt-2 font-medium">Batch it</p>
          <List
            items={[
              'Shoot 10 items per session in the same spot, about 3-4 minutes each.',
              'Edit lightly: crop square, nudge brightness up, no filters.',
              'Keep each item\'s photos together so listing goes fast.',
            ]}
          />
          <p className="mt-2 font-medium">Avoid</p>
          <List
            items={[
              'Mirror selfies with a messy room behind you.',
              'Dim rooms, yellow lamp light, and flash glare.',
              'Wrinkles, lint, pet hair, and items on a bare floor next to your shoes.',
            ]}
          />

          <H>Listing</H>
          <p className="mt-1">
            <strong>Title formula:</strong> Brand + item + key detail + size + NWT. For example, "Free
            People floral midi dress, size M, NWT".
          </p>
          <p className="mt-1" style={muted}>
            Each item in the shop has a <em>Copy title and description</em> button that fills this
            template in for you:
          </p>
          <pre
            className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg p-2 text-[11px]"
            style={{ background: 'var(--surface-page)' }}
          >
            {TEMPLATE}
          </pre>
          <p className="mt-1" style={muted}>
            Use about five hashtags, the words a buyer would actually type: brand, item, style (y2k,
            streetwear, cottagecore), color, and nwt.
          </p>
          <List
            items={[
              'Fill every field: category, subcategory, brand, size, condition (pick the brand-new option for tags-on items), color and style. Every field you fill is one more way for search to find the item.',
              'Accept any offer at or above your floor.',
              'Counter offers below your floor instead of declining: "Thanks! I can do $[counter], and it ships within 2 days."',
              'Reply within a few hours. Quick replies close sales.',
              'People who like an item are warm buyers. If the app lets you send them an offer, send 10% off.',
            ]}
          />

          <H>Weekly routine</H>
          <Rows
            head={['When', 'Task', 'Time']}
            rows={[
              ['Daily', 'List 2-3 new items', '20-30 min'],
              ['Daily', 'Answer messages and offers', '5 min'],
              ['Within 2 days of a sale', 'Pack and ship', '15 min'],
              ['Every Sunday', 'Shoot the next 10 items', '40 min'],
              ['14 days with no likes', 'New cover photo, then 10% off', '5 min each'],
              ['30 days unsold', 'Bundle it, or move it to Facebook Marketplace', '5 min each'],
            ]}
          />
        </div>
      )}
    </div>
  )
}
