import type { SinkingFund } from '../types'

/**
 * The money plan, as it stands from Nov 14, 2026.
 *
 * The first plan (Oct 4) was about surviving October and clearing the ~36%
 * loans. Those were all paid off on Oct 28, so this one replaces it: keep a
 * real cushion in checking, put $300 a month on the Apple Card, and send the
 * $5,250 reimbursement to the card when it lands. To-dos that still apply
 * keep their ids, so anything already ticked stays ticked.
 */
export const PLAN_UPDATED = '2026-11-14'
export const PLAN_DATE = '2026-10-04'
/** Bumped when the plan is rewritten, so a device can be moved onto it once. */
export const PLAN_VERSION = '2026-11-14'

/** The lump sum the payoff plan counts on, and the month it is expected. A guess until it is paid. */
export const LUMP = { amount: 5250, month: '2027-01', name: 'FedEx tuition reimbursement' }

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
    id: 'now',
    title: 'Now (Nov 14-30)',
    from: '2026-11-14',
    to: '2026-11-30',
    tasks: [
      { id: 'inspection', text: "Get the safety and emissions inspection ($30-40) if it isn't done yet. Registration can't be renewed without it." },
      { id: 'registration', text: 'Renew the registration. It was due Oct 31, so do it now to avoid a late fee or a ticket.' },
      {
        id: 'apple-nov-min',
        text: 'Pay the Apple Card by Nov 30: at least the $212 minimum, and $300 if the bank stays above the floor.',
        due: '2026-11-30',
      },
      { id: 'budget-setup', text: 'Enter food, gas, phone and car insurance on Home, so "safe to spend" is a real number.' },
      { id: 'gym-cancel', text: 'Send the Anytime Fitness cancellation email (the draft is in your Gmail) and keep the written confirmation.' },
      { id: 'people-nov', text: "Send November's $10 to each person you owe." },
      { id: 'call-ana', text: 'Check in with Ana Smith at 919-707-7983 about the wage claim, Case 220463.' },
      { id: 'peak-hours', text: 'Ask your FedEx supervisor about extra peak-season hours.' },
    ],
  },
  {
    id: 'december',
    title: 'December',
    from: '2026-12-01',
    to: '2026-12-31',
    tasks: [
      {
        id: 'asu-receipts',
        text: 'Save every ASU itemized receipt, and submit grades and receipts right after the term ends Dec 12.',
        due: '2026-12-12',
      },
      {
        id: 'tuition-call',
        text: 'Ask FedEx Tuition Assistance (1-888-901-6337) when the $5,250 will be paid, when to apply for spring, and whether this term used your whole yearly limit.',
      },
      { id: 'apple-dec-min', text: 'Pay the Apple Card by Dec 30: $300 if you can, never less than the minimum.', due: '2026-12-30' },
      { id: 'people-dec', text: "Send December's $10 to each person you owe." },
      { id: 'depop-first-10', text: 'Photograph and list your first 10 Depop items.' },
    ],
  },
  {
    id: 'new-year',
    title: 'January to March',
    from: '2027-01-01',
    to: '2027-03-31',
    tasks: [
      { id: 'lump-to-card', text: 'When the $5,250 lands, top PNC back up to the floor and put the rest on the Apple Card the same day.' },
      { id: 'apple-finish', text: 'Keep $300 a month going until the Apple Card is at zero.' },
      { id: 'people-after', text: 'Then send that $300 a month to the people you owe, smallest tab first.' },
      { id: 'mileage-tax', text: 'At tax time, save the mileage log from the Income tab and claim the deduction.' },
    ],
  },
]

/** "When the $5,250 lands" — in this order. */
export const LUMP_SUM: PlanTask[] = [
  { id: 'lump-floor', text: 'Top PNC back up to the floor if it has dipped below.' },
  { id: 'lump-card', text: 'Everything else goes on the Apple Card, the same day.' },
  { id: 'lump-rest', text: "If any is left after the card is at zero, pay the people you owe, smallest tab first." },
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
  { id: 'cut-gym', cut: 'Cancel Anytime Fitness', saves: '~$54/mo', how: 'The cancellation email is drafted in your Gmail. Add the club address, send it, and keep the written confirmation.' },
  { id: 'cut-rocket', cut: 'Cancel Rocket Money Premium', saves: '$8/mo', how: 'Your P-finance app already tracks subscriptions.' },
  { id: 'cut-icloud', cut: 'iCloud 2TB down to 200GB', saves: '~$7/mo', how: 'Only if you use under 200GB (Settings, your name, iCloud).' },
  { id: 'cut-photo-cloud', cut: 'Keep one photo cloud', saves: '~$2.50/mo', how: 'Google Photos is $29.99 a year and iCloud is monthly. Pick one before the next renewal.' },
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
  'If you can\'t pay cash today, the answer is "not yet." No new payment plans until the Apple Card is gone, and after that never more than one at a time.',
  'The checking floor is untouchable.',
  "The Apple Card minimum gets paid before anything optional. If you're ever about to miss it, message Apple Card support before the due date.",
  'Never borrow from one person to pay another. Skip payday loans and cash-advance apps entirely.',
  'Every lump sum follows the order in The plan.',
]

export const PAYCHECK_ORDER = [
  'Top PNC back up to the floor.',
  'Cover everything due before your next paycheck. Home shows it.',
  'Food and gas for the week.',
  'Move $20 to the car fund.',
  'Send the personal-debt payments: $10 each, once a month.',
  'Everything left goes on the Apple Card, up to $300 a month. Go past $300 only while the bank stays above the floor.',
]

export const MONEY_COMING: { source: string; amount: string; expected: string; status: string }[] = [
  { source: 'FedEx tuition reimbursement', amount: '$5,250', expected: 'Dec 2026-Feb 2027', status: 'Approved; pays after grades and receipts' },
  { source: 'NC DOL wage claim, Case 220463', amount: '$4,583-9,167', expected: 'Nov 2026-Mar 2027 (a guess)', status: 'Under investigation' },
]

/** Build checking to the floor in these steps. */
export const FLOOR_STEPS = [500, 1000, 1500]
export const FLOOR_TARGET = 1500
/** The first plan's floor, so a device still on it can be told apart from one set by hand. */
export const OLD_FLOOR_TARGET = 300

export const DEFAULT_FUNDS: SinkingFund[] = [
  { id: 'fund-car', name: 'Car', perWeek: 20, balance: 0, covers: 'Registration, inspection, oil, tires, repairs' },
  { id: 'fund-fun', name: 'Fun', perWeek: 10, balance: 0, covers: 'Raves, dates, boba, paid in cash', afterFloor: true },
]
