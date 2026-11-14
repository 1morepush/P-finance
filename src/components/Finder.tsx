import { useState } from 'react'
import { Modal } from './Modal'
import type { Tab } from './BottomNav'

interface Place {
  label: string
  /** Other words someone might type for it. */
  also?: string
  tab: Tab
  /** A folded section to open on the way, by its id. */
  section?: string
  /** Heading text, or a `data-find` key, to scroll to once the tab is showing. */
  at?: string
}

const TAB_NAME: Record<Tab, string> = {
  dashboard: 'Home',
  debts: 'Debts',
  calendar: 'Calendar',
  income: 'Income',
  plan: 'Plan',
  settings: 'Settings',
}

const PLACES: Place[] = [
  { label: 'Bank balance', also: 'pnc update checking', tab: 'dashboard', at: 'bank' },
  { label: 'Sent but not out of PNC yet', also: 'pending posted', tab: 'dashboard', at: 'bank' },
  { label: 'Safe to spend', also: 'afford budget', tab: 'dashboard', at: 'safe' },
  { label: 'Food, gas, phone and insurance budget', also: 'groceries living', tab: 'dashboard', at: 'safe' },
  { label: 'Apple Card payoff plan', also: 'credit card interest debt free', tab: 'dashboard', at: 'payoff' },
  { label: 'Car inspection and registration', also: 'car costs', tab: 'dashboard', at: 'Car costs coming up' },
  { label: 'Type what you did', also: 'quick add log payment sentence', tab: 'dashboard', at: 'Tell it what you did' },
  { label: "This week's bills", also: 'due week', tab: 'dashboard', section: 'home-week' },
  { label: 'To-do list', also: 'tasks', tab: 'dashboard', section: 'home-todo' },
  { label: 'Log a paycheck and split it', also: 'income pay', tab: 'dashboard', section: 'home-income' },
  { label: 'Runway', also: 'how long money lasts', tab: 'dashboard', section: 'home-runway' },
  { label: 'All debts, Pay and Paid off', also: 'log payment klarna paypal affirm', tab: 'debts' },
  { label: 'People I owe', also: 'liv himeth yuuko aiya ben personal tab', tab: 'debts', at: 'Personal / flexible' },
  { label: 'Undo a payment, payment history', also: 'logged payments mistake', tab: 'debts', section: 'debts-history' },
  { label: 'Payoff order and strategy', also: 'avalanche snowball tier', tab: 'debts', section: 'debts-plan' },
  { label: 'Progress chart', also: 'graph total paid off', tab: 'debts', at: 'Progress' },
  { label: 'Calendar of due dates', also: 'month payments', tab: 'calendar' },
  { label: 'In the bank by Saturday', also: 'projection end of week', tab: 'calendar' },
  { label: "Add payments to my phone's calendar", also: 'reminders ics', tab: 'calendar' },
  { label: 'FedEx paycheck estimate and payday', also: 'pay hourly tax', tab: 'income', at: 'FedEx paycheck estimate' },
  { label: 'Where the paycheck goes', tab: 'income', at: 'Where the paycheck goes' },
  { label: 'Living costs and subscriptions', also: 'gym claude icloud expenses', tab: 'income', at: 'Living costs' },
  { label: 'Gig work: log a DoorDash shift', also: 'instawork uber shift', tab: 'income', at: 'Gig work' },
  { label: 'Mileage log for taxes', also: 'irs deduction csv miles', tab: 'income', at: 'Mileage log' },
  { label: 'Gas fill-up calculator', also: 'fuel acura', tab: 'income', at: 'Gas' },
  { label: 'Depop shop', also: 'sell clothes listing', tab: 'income', at: 'Depop shop' },
  { label: 'Money coming (wage claim, tuition)', also: '5250 reimbursement', tab: 'income', at: 'Potential upside' },
  { label: 'Money plan and to-dos', tab: 'plan' },
  { label: 'Sunday check-in', tab: 'plan', at: 'Sunday check-in' },
  { label: 'Cost cutters', also: 'cancel save', tab: 'plan', section: 'plan-cuts' },
  { label: 'Checking floor and car fund', also: 'sinking fund saving', tab: 'plan', section: 'plan-saving' },
  { label: 'Ways to earn more', also: 'jobs remote', tab: 'plan', section: 'plan-earning' },
  { label: 'Backup, export and import', also: 'save data', tab: 'settings', at: 'Backup' },
  { label: 'Checking floor amount', tab: 'settings', at: 'Checking floor' },
  { label: 'Link bank with Stripe', tab: 'settings', at: 'Bank balance from Stripe' },
  { label: 'App version and what changed', also: 'update', tab: 'settings', at: 'App version' },
]

const SECTIONS_KEY = 'p-finance/sections/v1'

/** Opens a folded section before its tab is drawn, by the same record the section reads. */
function openSection(id: string) {
  try {
    const all = JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? '{}') as Record<string, boolean>
    localStorage.setItem(SECTIONS_KEY, JSON.stringify({ ...all, [id]: true }))
  } catch {
    // The tab still opens; the section is just left folded.
  }
}

function scrollTo(target: string) {
  const el =
    document.querySelector(`[data-find="${target}"]`) ??
    [...document.querySelectorAll('h1, h2, h3')].find((h) => h.textContent?.trim().startsWith(target))
  el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

/**
 * "Where is…?" — every place in the app by the words someone would use for
 * it. Picking one opens its tab, unfolds its section and scrolls to it.
 */
export function Finder({ onGo, onClose }: { onGo: (tab: Tab) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const hits = PLACES.filter((p) => {
    const hay = `${p.label} ${p.also ?? ''} ${TAB_NAME[p.tab]}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })

  function go(p: Place) {
    if (p.section) openSection(p.section)
    onGo(p.tab)
    onClose()
    const target = p.at ?? p.section
    // After the tab has drawn.
    if (target) setTimeout(() => scrollTo(target), 120)
    else window.scrollTo({ top: 0 })
  }

  return (
    <Modal title="Find" onClose={onClose}>
      <input
        type="search"
        autoFocus
        placeholder="What are you looking for?"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm"
        style={{ background: 'var(--surface-page)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        aria-label="Search the app"
      />
      <div className="mt-2 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
        {hits.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => go(p)}
            className="flex items-baseline justify-between gap-3 py-2 text-left text-sm"
          >
            <span>{p.label}</span>
            <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
              {TAB_NAME[p.tab]} ›
            </span>
          </button>
        ))}
        {hits.length === 0 && (
          <p className="py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            Nothing by that name. Try one word, like "gas" or "Liv".
          </p>
        )}
      </div>
    </Modal>
  )
}
