import type { SinkingFund } from '../types'

/**
 * The Money Recovery Plan of Oct 4, 2026, as written. Every figure here is
 * the plan's own and is shown as it stands — estimates, ranges and all. The
 * live balances are the app's; this is the plan for what to do with them.
 *
 * Updated Oct 5, at the user's request, for the oil-change Pay in 4 and the
 * people tabs from the Oct 5 note: October instalments $695.33 → $704.98,
 * personal debts after December ~$1,520 → ~$1,780, so the Apple Card's share
 * of the $5,250 ~$1,970 → ~$1,710. The ~36% loans are unchanged at ~$1,260.
 */
export const PLAN_UPDATED = '2026-10-05'
export const PLAN_DATE = '2026-10-04'

export interface PlanTask {
  id: string
  text: string
  /** The day it is due by, where the plan names one. */
  due?: string
}

export interface PlanPhase {
  id: string
  title: string
  /** Shown from this day. */
  from: string
  /** Its window closes this day; anything left open carries on. */
  to: string
  tasks: PlanTask[]
}

export const PHASES: PlanPhase[] = [
  {
    id: 'week1',
    title: 'This week (Oct 4-10)',
    from: '2026-10-04',
    to: '2026-10-10',
    tasks: [
      {
        id: 'apple-sept-min',
        text: "Pay what you can toward September's Apple Card minimum now, and all $212 before Oct 30. After that, a late payment can be reported to the credit bureaus.",
        due: '2026-10-30',
      },
      {
        id: 'call-ana',
        text: 'Call Ana Smith back on Mon Oct 5 or later at 919-707-7983, with Case 220463 and your documents ready.',
        due: '2026-10-05',
      },
      {
        id: 'pnc-197',
        text: 'Have $197.67 in PNC by Oct 6 for Frontier (Oct 7), Amazon (Oct 8) and ACE (Oct 10).',
        due: '2026-10-06',
      },
      { id: 'inspection', text: "Get the safety and emissions inspection ($30-40). Registration can't be renewed without it." },
      { id: 'oil', text: 'Do the DIY oil change ($35-50). Check your manual for the oil grade, likely 0W-20.' },
      { id: 'ux-study', text: 'Ask the UX study whether its 3-shift cap covers all your bookings, and cancel the extra shifts early.' },
      { id: 'apply-remote', text: 'Apply to the three remote roles in Earning more.' },
      { id: 'overdraft-off', text: 'Turn off overdraft coverage on your PNC debit card and set a low-balance alert at $100.' },
      { id: 'depop-first-10', text: 'Photograph and list your first 10 Depop items.' },
      { id: 'ten-a-month', text: 'Text everyone you owe the $10-a-month plan, and send the first $10.' },
    ],
  },
  {
    id: 'october',
    title: 'Rest of October',
    from: '2026-10-11',
    to: '2026-10-31',
    tasks: [
      {
        id: 'registration',
        text: 'Pay the registration renewal by Oct 31. The exact amount is on your renewal notice.',
        due: '2026-10-31',
      },
      { id: 'apple-oct-min', text: "Pay October's Apple Card minimum by Oct 31.", due: '2026-10-31' },
      { id: 'floor-150-300', text: 'Build the PNC floor to $150, then $300.' },
      { id: 'cuts', text: 'Freeze the gym, cancel Rocket Money, and downgrade iCloud if you can.' },
      { id: 'instawork', text: 'Work every booked Instawork shift, and DoorDash the 10:30-3 lunch block on free mornings.' },
    ],
  },
  {
    id: 'nov-dec',
    title: 'November to mid-December',
    from: '2026-11-01',
    to: '2026-12-15',
    tasks: [
      {
        id: 'klarna-ends',
        text: 'Klarna ends Nov 5. Put the freed-up money toward Affirm Tokyo or the Airbnb loan.',
        due: '2026-11-05',
      },
      { id: 'photo-cloud', text: 'Choose Google Photos or iCloud before Google renews on Nov 10.', due: '2026-11-10' },
      { id: 'peak-hours', text: 'Ask your FedEx supervisor about extra peak-season hours.' },
      {
        id: 'tuition-call',
        text: 'Ask FedEx Tuition Assistance (1-888-901-6337) when to apply for spring, and whether this term used your whole yearly limit.',
      },
      {
        id: 'asu-receipts',
        text: 'Save every ASU itemized receipt, and submit grades and receipts right after the term ends Dec 12.',
        due: '2026-12-12',
      },
    ],
  },
]

/** "When the $5,250 lands" — in this order. */
export const LUMP_SUM: PlanTask[] = [
  { id: 'lump-apple-past-due', text: 'Anything past due on the Apple Card.' },
  { id: 'lump-36', text: 'The six ~36% loans: about $1,260 left by January.' },
  { id: 'lump-emergency', text: "A $500 starter emergency fund, so the next car repair doesn't become new debt." },
  { id: 'lump-personal', text: 'Your personal debts: about $1,780 after $50 a month through December.' },
  { id: 'lump-apple', text: 'The Apple Card: the remaining ~$1,710.' },
]

export const SUNDAY_CHECK_IN: PlanTask[] = [
  { id: 'ci-balances', text: 'Update every balance in P-finance.' },
  { id: 'ci-autopays', text: 'Look at every autopay due in the next 14 days, and move money so each one clears.' },
  { id: 'ci-gig', text: "Log this week's gig miles and earnings." },
  { id: 'ci-depop', text: 'Shoot the next 10 Depop items, and ship anything that sold.' },
  { id: 'ci-apply', text: 'Send 2 job applications.' },
  { id: 'ci-personal', text: 'Send any personal-debt payments that are due.' },
  { id: 'ci-car', text: 'Move $20 to the car fund.' },
]

export interface CostCut {
  id: string
  cut: string
  saves: string
  how: string
}

export const COST_CUTS: CostCut[] = [
  { id: 'cut-gym', cut: 'Freeze Anytime Fitness', saves: '~$54/mo', how: "Ask the front desk about a freeze and its fee. Cancel if there's no freeze option." },
  { id: 'cut-rocket', cut: 'Cancel Rocket Money Premium', saves: '$8/mo', how: 'Your P-finance app already tracks subscriptions.' },
  { id: 'cut-icloud', cut: 'iCloud 2TB down to 200GB', saves: '~$7/mo', how: 'Only if you use under 200GB (Settings, your name, iCloud).' },
  { id: 'cut-photo-cloud', cut: 'Keep one photo cloud', saves: '~$2.50/mo', how: 'Google Photos renews Nov 10 at $29.99 a year.' },
  { id: 'cut-claude', cut: 'Claude Pro', saves: '$20/mo', how: "Drop to the free plan if you aren't using it most weeks." },
  {
    id: 'cut-overdraft',
    cut: 'Debit overdraft coverage off, $100 alert on',
    saves: '$36 per fee avoided',
    how: 'Card purchases decline instead of overdrafting. Autopays can still overdraft, so keep the floor.',
  },
  { id: 'cut-fast-pay', cut: 'Fast Pay only at $40-50+', saves: '~$4-8/mo', how: 'Let smaller amounts ride to the next shift or the free weekly deposit.' },
  {
    id: 'cut-gas',
    cut: 'Gas habits',
    saves: '~$15-30/mo (approx.)',
    how: 'Check whether premium is required or only recommended, use GasBuddy, turn the engine off for waits over a minute, decline orders under $1.50 a mile.',
  },
  { id: 'cut-phone', cut: 'Phone plan', saves: 'Varies', how: 'If your Verizon bill is over about $50, a prepaid plan on the same network often costs about half.' },
  { id: 'cut-no-plans', cut: 'No new payment plans', saves: 'The biggest one', how: 'Every plan this year started as "only $30 a month."' },
]

export interface EarnOption {
  option: string
  pay: string
  keep: string
  notes: string
  links?: { label: string; href: string }[]
}

export const EARNING: EarnOption[] = [
  {
    option: 'Remote part-time role',
    pay: '$20-45/hr',
    keep: '~$170-380 a week for 10 hrs, after ~15% tax',
    notes: 'No gas or commute. Apply to:',
    links: [
      { label: 'Victory Programming ($30-45)', href: 'https://to.indeed.com/aagsqhzyc7fv' },
      { label: 'Purchasing 411 ($25-28)', href: 'https://to.indeed.com/aa9cj8wy86bf' },
      { label: 'Consilio ($27.51-33.13)', href: 'https://to.indeed.com/aav6vdsqw86z' },
      { label: 'LightSpring ($20-22)', href: 'https://to.indeed.com/aawbpln668ds' },
    ],
  },
  { option: 'Extra FedEx hours', pay: '$17.45/hr', keep: '~$13.60/hr', notes: 'You already drive there. Ask about peak-season hours in November and December.' },
  { option: 'Instawork shifts', pay: '$14-25/hr', keep: 'Pay minus gas', notes: 'Book close to home and around FedEx. Check whether each listing is W-2 or 1099.' },
  { option: 'DoorDash, 10:30-3 lunch block', pay: '$65-90 a session', keep: '~$50-75', notes: 'Decline orders under $1.50 a mile. Fast Pay only at $40-50+.' },
  { option: 'Depop', pay: '$40-90 the first week', keep: "After Depop's fees", notes: 'See the Depop shop on the Income tab.' },
  { option: 'Facebook Marketplace', pay: 'Varies', keep: 'All of it, local cash', notes: "Electronics, household items, anything that isn't clothing." },
  { option: 'Paid photo sessions', pay: '$50-150 a session (approx.)', keep: 'Most of it', notes: "Fall portraits and graduation photos, if your camera's ready to go." },
  {
    option: 'Plasma donation',
    pay: 'New-donor promos',
    keep: 'All of it',
    notes: "Check eligibility and current promos. Eat and hydrate first, and don't go right before a long shift.",
  },
]

export const RULES = [
  'If you can\'t pay cash today, the answer is "not yet." No new payment plans until the ~36% loans are gone, and after that never more than one at a time.',
  'The checking floor is untouchable.',
  "The Apple Card minimum gets paid before anything optional. If you're ever about to miss it, message Apple Card support before the due date.",
  'Never borrow from one person to pay another. Skip payday loans and cash-advance apps entirely.',
  'Every lump sum follows the order in The plan.',
]

export const PAYCHECK_ORDER = [
  'Top PNC back up to the floor.',
  'Cover everything due before your next paycheck. Check the next 14 days in your app.',
  'Move $20 to the car fund.',
  'Send the personal-debt payments: $50 a month in total, $10 each.',
  'Put everything left on Affirm Tokyo or the Airbnb loan, which free up the most monthly cash per dollar paid.',
]

/** The October squeeze, as estimated. */
export const OCTOBER: [string, string][] = [
  ['In: FedEx, 15-18.5 hrs a week', '$880-1,090'],
  ['In: Instawork, after tax and gas', '$260-515'],
  ['Out: loan installments', '$704.98'],
  ['Out: Apple Card minimum', "$212, or about $424 if September's is still unpaid"],
  ['Out: inspection, oil, registration', '$165-290 (approx.)'],
  ['Out: subscriptions and gym', 'about $88'],
]

export const MONEY_COMING: { source: string; amount: string; expected: string; status: string }[] = [
  { source: 'FedEx tuition reimbursement', amount: '$5,250', expected: 'Dec 2026-Feb 2027', status: 'Approved; pays after grades and receipts' },
  { source: 'NC DOL wage claim, Case 220463', amount: '$4,583-9,167', expected: 'Nov 2026-Mar 2027 (a guess)', status: 'Under investigation' },
  { source: 'Instawork, October', amount: '$361-693 gross', expected: 'Oct 2026', status: 'Booked; labor shifts unconfirmed' },
]

/** Build checking to the floor in these steps. */
export const FLOOR_STEPS = [100, 200, 300]
export const FLOOR_TARGET = 300

export const DEFAULT_FUNDS: SinkingFund[] = [
  { id: 'fund-car', name: 'Car', perWeek: 20, balance: 0, covers: 'Registration, inspection, oil, tires, repairs' },
  { id: 'fund-fun', name: 'Fun', perWeek: 10, balance: 0, covers: 'Raves, dates, boba, paid in cash', afterFloor: true },
]
