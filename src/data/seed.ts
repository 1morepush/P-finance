import type { AppState, LedgerEntry } from '../types'

/**
 * Turns a list of signed amounts into ledger lines with stable ids, so the
 * seeded tabs survive a reload and can be edited one line at a time.
 */
function tab(who: string, amounts: number[]): LedgerEntry[] {
  return amounts.map((amount, i) => ({
    id: `${who}-seed-${i}`,
    date: '2026-09-17',
    amount,
    ...(amount < 0 ? { note: 'Payment' } : {}),
  }))
}

// Source of truth: the status supplied 2026-09-30, read off the lender apps.
// Totals this data produces (verified against the source before seeding):
//   active             $12,210.85   the source's $11,902.99, plus $307.86 below
//   of which estimated      $0.00   Affirm's AutoPay emails confirm all four
//   cleared to date     $1,787.64   Delta added
//
// What changed from Sep 28:
//
//   Airbnb (cousin) carries about 36% APR, not 0%. $722.00 financed is
//   repaid as $799.17, and $133.28 is exactly the payment on $722 over six
//   months at 36%. It moves from tier 2 to tier 1.
//
//   Tokyo is $267.25 with Oct 3 next — five payments, not four. The Sep 28
//   figure had the Sep 3 payment taken off twice. Affirm's Oct 3 reminder and
//   its AutoPay schedule both confirm it.
//
//   Omio's Sep 29 payment posted: $526.87, Oct 29 next.
//
//   Atlanta $253.56 and Columbia $209.10, rounding corrected.
//
//   Delta cleared — paid early on Sep 29, confirmed paid in full.
//
// Affirm AutoPay was switched on for Tokyo, Atlanta, Columbia and Airbnb on
// Sep 30, from the Visa ending 0153. Each schedule it emailed sums to the
// balance here to the cent, so none of the four is an estimate any more.
//
// Himeth $548.68 and Liv $378.08 are, again, not used. They are the running
// totals from before the Sep 17 correction — $866.54 − $317.86 and
// $368.08 + $10 — confirmed at the time as $866.54 and $368.08. The status
// repeats the old figures; it does not report a payment. Kept at the
// confirmed amounts, which is where the $307.86 difference comes from.
//
// Klarna extended two due dates on Sep 21, each the one extension its order
// allows: Frontier (Sep 30 → Oct 7) and ACE small (Sep 25 → Oct 2). Recorded
// as deferrals so the lost fallback is visible on the debt.

/**
 * Bump whenever the figures below change. Devices carrying an older stamp are
 * offered the update rather than silently keeping their copy: saved state
 * replaces the seed wholesale on load, so without this a reconciliation never
 * reaches a phone that has opened the app before.
 */
export const SEED_VERSION = '2026-09-30'

/**
 * The date the lender figures below were taken. Separate from the version,
 * which carries a suffix for revisions of the same table — formatting the
 * version as a date printed "Invalid Date" on every device that saw an update.
 * Payments logged by hand on or after this date are not in the table and are
 * re-applied when it is loaded.
 */
export const SEED_DATE = '2026-09-30'

export const seedState: AppState = {
  seedVersion: SEED_VERSION,
  bankBalance: {
    amount: 719,
    updatedAt: '2026-08-13',
  },
  savingsBalance: 0,
  settings: {
    strategy: 'tier',
    savingsPercent: 10,
    keepInCheckingPercent: 10,
  },
  pendingClaims: [
    {
      id: 'claim-gridpal',
      name: 'GridPal unpaid raise wage claim',
      low: 4583.33,
      high: 9166.66,
      notes:
        'Filed with NC DOL: case 220463, under investigation. Investigator Ana Smith back Oct 5. Expected Nov 2026 – Mar 2027, paid by DOL check. Jan 1 – Jun 15, 2026 unpaid raise. Treated as upside, not a planning dependency.',
    },
    {
      id: 'claim-fedex-tuition',
      name: 'FedEx tuition reimbursement',
      low: 5250,
      high: 5250,
      notes:
        'Approved, pending completion. Submit grades and itemized receipts after Dec 12, 2026; expected Dec 2026 – Feb 2027. Check whether loans or aid reduce the payout.',
    },
  ],
  incomeSources: [
    {
      id: 'income-gridpal',
      name: 'GridPal LLC — Revenue Operations Analyst',
      amount: 1461.54,
      frequency: 'biweekly',
      active: false,
      notes:
        'Employment ended June 15, 2026 (role eliminated). Contracted raise to $48,000/yr effective Jan 1, 2026 was never paid — see pending GridPal wage claim.',
    },
    {
      id: 'income-unemployment',
      name: 'Unemployment insurance',
      amount: 335,
      frequency: 'weekly',
      // Confirmed ended Sep 2026 — the payments have stopped. Kept as an
      // inactive record rather than deleted, so the history of what was coming
      // in is not lost, and so it can be switched back on if it resumes.
      active: false,
      notes:
        'Confirmation #45287027. Ran ~12 weeks from the June 15 job loss and has now ended. No further payments expected.',
    },
    {
      id: 'income-freelance',
      name: 'Freelance (Upwork)',
      amount: 0,
      frequency: 'variable',
      active: true,
      notes:
        'Python, SQL, Excel/Sheets automation, fuzzy matching, CRM tools (Salesforce, Apollo, HubSpot), data enrichment. Profile drafted, not yet earning — log entries as they come in.',
    },
    {
      id: 'income-product',
      name: 'Debt Snowball Calculator (Gumroad)',
      amount: 12,
      frequency: 'variable',
      active: true,
      notes: 'Excel digital product, 3 tabs, ~$12/sale. Per-sale income once published.',
    },
  ],
  incomeEntries: [],
  payments: [],
  shifts: [],
  snapshots: [],

  // EPA 18/26 for the base 3.5L FWD, which combines to 20.9 — the figures the
  // window sticker carried. The reserve is the usual couple of gallons still in
  // the tank when the range display gives up; correct it from a real fill-up.
  vehicle: {
    name: '2010 Acura TL',
    cityMpg: 18,
    highwayMpg: 26,
    tankGallons: 18.5,
    reserveGallons: 2,
  },
  // Recurring costs from the Sep 28 status. Rent is confirmed as nil. Food,
  // phone, car insurance and gas have still not been supplied and are not
  // guessed at: a made-up figure would make the plan look precise while
  // being wrong.
  //
  // The status also lists the $212 Apple Card minimum as a recurring cost. It
  // is left out here on purpose — it is already a scheduled debt payment, and
  // listing it again would count it twice in every week's total.
  // Due dates are the status's own, so each one lands on the calendar on its
  // day. Google Photos is billed yearly and is drawn as $29.99 on Nov 10; the
  // budget still spreads it as $2.50 a month.
  expenses: [
    { id: 'exp-claude', name: 'Claude Pro', amount: 20, cadence: 'monthly', essential: false, nextDue: '2026-10-02' },
    { id: 'exp-icloud', name: 'iCloud+ 2TB', amount: 9.99, cadence: 'monthly', essential: false, nextDue: '2026-10-02' },
    { id: 'exp-google-photos', name: 'Google Photos 200GB', amount: 29.99, cadence: 'yearly', essential: false, nextDue: '2026-11-10' },
    { id: 'exp-anytime-fitness', name: 'Anytime Fitness', amount: 25, cadence: 'biweekly', essential: false, nextDue: '2026-09-28' },
    // The status gave Rocket Money's date as "verify": left without one rather
    // than guessed. It counts in the budget; setting a date puts it on the
    // calendar.
    { id: 'exp-rocket-money', name: 'Rocket Money Premium', amount: 8, cadence: 'monthly', essential: false },
  ],

  // Tier 0 — urgent · Tier 1 — ~36% APR · Tier 2 — 0% promo BNPL
  // Tier 3 — Apple Card · Tier 4 — personal / flexible
  debts: [
    {
      id: 'paypal_autozone',
      name: 'PayPal AutoZone',
      product: 'paypal_pay_monthly',
      status: 'active',
      priorityTier: 1,
      balance: 349.03,
      apr: 35.99,
      monthlyPayment: 34.91,
      nextDue: '2026-10-13',
      finalPaymentDate: '2027-07-13',
    },
    {
      id: 'paypal_omio',
      name: 'PayPal Omio',
      product: 'paypal_pay_monthly',
      status: 'active',
      priorityTier: 1,
      balance: 526.87,
      apr: 35.99,
      monthlyPayment: 52.7,
      nextDue: '2026-10-29',
      finalPaymentDate: '2027-07-29',
      notes:
        'The Sep 29 payment posted. $526.87 at $52.70 is 10 payments, Oct 29, 2026 to Jul 29, 2027.',
    },
    {
      id: 'affirm_atlanta',
      name: 'Affirm SpringHill Suites Atlanta',
      product: 'affirm_pay_monthly',
      status: 'active',
      priorityTier: 1,
      balance: 253.56,
      apr: 36.0,
      monthlyPayment: 36.28,
      nextDue: '2026-10-20',
      finalPaymentDate: '2027-04-20',
      notes:
        'Shown in Affirm as a Hotels.com plan. AutoPay on since Sep 30 from the Visa ending 0153: six of $36.28 from Oct 20, then $35.88 on Apr 20, 2027 — $253.56.',
    },
    {
      id: 'affirm_columbia',
      name: 'Affirm La Quinta Columbia',
      product: 'affirm_pay_monthly',
      status: 'active',
      priorityTier: 1,
      balance: 209.1,
      apr: 36.0,
      monthlyPayment: 26.17,
      nextDue: '2026-10-21',
      finalPaymentDate: '2027-05-21',
      notes:
        'AutoPay on since Sep 30 from the Visa ending 0153: seven of $26.17 from Oct 21, then $25.91 on May 21, 2027 — $209.10.',
    },
    {
      id: 'affirm_tokyo',
      name: 'Affirm Hotel Keihan Tokyo',
      product: 'affirm_pay_monthly',
      status: 'active',
      priorityTier: 1,
      balance: 267.25,
      apr: 36.0,
      monthlyPayment: 53.45,
      nextDue: '2026-10-03',
      finalPaymentDate: '2027-02-03',
      notes:
        'Five payments of $53.45, Oct 3, 2026 to Feb 3, 2027. The Sep 28 figure of $213.80 had the Sep 3 payment taken off twice. Affirm emailed an Oct 3 reminder, and AutoPay is on since Sep 30 from the Visa ending 0153.',
    },
    {
      id: 'affirm_airbnb_cousin',
      name: 'Affirm Airbnb (cousin)',
      product: 'affirm_pay_monthly',
      status: 'active',
      priorityTier: 1,
      balance: 665.89,
      apr: 36.0,
      monthlyPayment: 133.28,
      nextDue: '2026-10-17',
      finalPaymentDate: '2027-02-17',
      notes:
        'Not 0%: $722.00 financed is repaid as $799.17, about 36% APR, and $133.28 is exactly the six-month payment on $722 at 36%. About $55 of the interest is still to come. AutoPay on since Sep 30 from the Visa ending 0153: four of $133.28 from Oct 17, then $132.77 on Feb 17, 2027 — $665.89.',
    },
    {
      id: 'klarna_ace_large',
      name: 'Klarna ACE Rent A Car (large)',
      product: 'klarna_pay_in_4',
      status: 'active',
      priorityTier: 2,
      balance: 90.68,
      apr: 0,
      monthlyPayment: 90.68,
      nextDue: '2026-10-10',
      finalPaymentDate: '2026-10-10',
      notes:
        'One payment left: $90.68 on Oct 10.',
    },
    {
      id: 'klarna_ace_small',
      name: 'Klarna ACE Rent A Car (small)',
      product: 'klarna_pay_in_4',
      status: 'active',
      priorityTier: 2,
      balance: 53.88,
      apr: 0,
      monthlyPayment: 26.94,
      nextDue: '2026-10-02',
      finalPaymentDate: '2026-10-16',
      deferrals: [{ date: '2026-09-21', from: '2026-09-25', to: '2026-10-02', note: 'Klarna due-date extension — one per order, now used' }],
      notes:
        'Due date extended in Klarna on Sep 21: the Sep 25 payment moved to Oct 2, then Oct 16. Klarna allows one extension per order, so this plan has used its one.',
    },
    {
      id: 'klarna_flight',
      name: 'Klarna Frontier Airlines (Ohio)',
      product: 'klarna_pay_in_4',
      status: 'active',
      priorityTier: 2,
      balance: 223.47,
      apr: 0,
      monthlyPayment: 74.49,
      nextDue: '2026-10-07',
      finalPaymentDate: '2026-11-04',
      deferrals: [{ date: '2026-09-21', from: '2026-09-30', to: '2026-10-07', note: 'Klarna due-date extension — one per order, now used' }],
      notes:
        'Frontier flight: $302.95 in four ($297.96 + $4.99 fee), the first $79.48 paid Sep 12. Due date extended in Klarna on Sep 21: the remaining three of $74.49 now run Oct 7, Oct 21 and Nov 4. Klarna allows one extension per order, so this plan has used its one. The $79.48 is not in payment history — a debt here carries one payment amount.',
    },
    {
      id: 'amazon_pay_in_4',
      name: 'Klarna Amazon',
      // Klarna, not Amazon's own plan. The merchant is Amazon; the lender is
      // who a dispute or a hardship call goes to, and that is Klarna.
      product: 'klarna_pay_in_4',
      status: 'active',
      priorityTier: 2,
      // What is left, not the $133.49 total: the Sep 20 instalment was $35.99
      // against $32.50 for the other three, and a debt here carries one payment
      // amount. Seeding the total would have projected five payments, not four.
      balance: 97.5,
      apr: 0,
      monthlyPayment: 32.5,
      nextDue: '2026-10-08',
      finalPaymentDate: '2026-11-05',
      notes:
        "Read off Klarna on Sep 21: $133.49 bought Sep 18, four payments, $35.99 paid Sep 20 and three of $32.50 left on Oct 8, Oct 22 and Nov 5. Those three are exactly biweekly and reconcile; only the Sep 20 to Oct 8 gap is 18 days, the same shape as the Frontier plan. Autopay is on, charging the Klarna balance first and then the card ending 0153. The $35.99 is not in the payment history — an uneven first instalment cannot be modelled here. Ref 1908110699029268.",
    },
    {
      id: 'apple_card',
      name: 'Apple Card',
      product: 'credit_card',
      status: 'active',
      priorityTier: 3,
      balance: 7497.0,
      apr: 22.49,
      // A card is paid by hand, not on autopay, so a passed due date is never
      // assumed to have gone through.
      autoMarkPaid: false,
      monthlyPayment: 212.0,
      nextDue: '2026-09-30',
      notes:
        'Revolving — no lender-set payoff date. Held flat at $212/mo it clears in about 57 payments; real card minimums shrink as the balance falls, which is what stretches these to 10+ years.',
    },
    // The four running tabs, seeded line by line as supplied on 2026-09-17.
    // No dates or descriptions came with the lines, so each is stamped with the
    // day it was recorded and left for a note to be added — which is the whole
    // point of keeping them itemised rather than as a total.
    {
      id: 'himeth',
      name: 'Himeth',
      product: 'personal',
      status: 'active',
      priorityTier: 4,
      balance: 866.54,
      apr: 0,
      nextDue: 'flexible',
      ledger: tab('himeth', [
        591, 15, 27, 7.19, 7.19, 6, 6, 21.5, -50, -50.95, -31.25, 317.86,
      ]),
      // $866.54 confirmed on 2026-09-17: the +$317.86 belongs, and the $548.68
      // quoted alongside was the running total before it.
      notes: 'Twelve lines as supplied, confirmed at $866.54.',
    },
    {
      id: 'liv',
      name: 'Liv',
      product: 'personal',
      status: 'active',
      priorityTier: 4,
      balance: 368.08,
      apr: 0,
      nextDue: 'flexible',
      ledger: tab('liv', [664.64, -178.56, -74, -34, -10]),
    },
    {
      id: 'aiya',
      name: 'Aiya',
      product: 'personal',
      status: 'active',
      priorityTier: 4,
      balance: 300.0,
      apr: 0,
      nextDue: 'flexible',
      // Only a total was supplied, so the tab opens with one line to add to.
      ledger: tab('aiya', [300]),
    },
    {
      id: 'yuuko',
      name: 'Yuuko',
      product: 'personal',
      status: 'active',
      priorityTier: 4,
      balance: 276.0,
      apr: 0,
      nextDue: 'flexible',
      ledger: tab('yuuko', [276]),
    },
    {
      id: 'new_friend',
      name: 'New Friend',
      product: 'personal',
      status: 'active',
      priorityTier: 4,
      balance: 166.0,
      apr: 0,
      nextDue: 'flexible',
      ledger: [
        { id: 'new_friend-seed-0', date: '2026-09-14', amount: 296, note: 'Owed as of the Sep 14 update' },
        { id: 'new_friend-seed-1', date: '2026-09-25', amount: -130, note: 'Payment' },
      ],
      // A part-payment is a line on the tab, not a cleared debt: the cleared
      // log is for debts paid off, and counting $130 there as well as here
      // would count it twice.
      notes: 'Paid $130 on Sep 25; $166 left, due later.',
    },
  ],

  clearedDebts: [
    {
      id: 'delta_airlines',
      name: 'PayPal Delta Airlines',
      product: 'paypal_pay_in_4',
      amountCleared: 52.85,
      dateCleared: '2026-09-29',
      notes: 'Paid in full on Sep 29, early — the last $52.85 was due Oct 8.',
    },
    {
      id: 'edco_tix_2',
      name: 'EDC Orlando Tickets #2',
      product: 'event_installment',
      amountCleared: 58.48,
      dateCleared: '2026-09-25',
    },
    {
      id: 'edco_tix_1',
      name: 'EDC Orlando Tickets #1',
      product: 'event_installment',
      amountCleared: 34.75,
      dateCleared: '2026-09-11',
    },
    {
      id: 'cousin',
      name: 'Cousin',
      product: 'personal',
      amountCleared: 350.0,
      dateCleared: '2026-08-27',
      // Off the total, but no money left the account — so it is kept out of
      // the rate at which debt is actually being paid down.
      forgiven: true,
      notes: 'Forgiven — cousin said keep the money.',
    },
    {
      id: 'affirm_dc',
      name: 'Affirm Holiday Inn Express DC',
      product: 'affirm_pay_monthly',
      amountCleared: 89.87,
      dateCleared: '2026-08-27',
      notes:
        'Confirmed $0.00 remaining. $89.87 was the balance still outstanding here; $191.39 was paid across the life of the plan.',
    },
    {
      id: 'paypal_negative',
      name: 'PayPal negative balance',
      product: 'paypal',
      amountCleared: 559.2,
      dateCleared: '2026-08-13',
    },
    {
      id: 'old_klarna_combo',
      name: 'Old Klarna Airbnb + Walmart',
      product: 'klarna',
      amountCleared: 387.58,
      dateCleared: '2026-08-13',
    },
    {
      id: 'affirm_amazon',
      name: 'Affirm Amazon',
      product: 'affirm_pay_in_4',
      amountCleared: 39.32,
      dateCleared: '2026-08-13',
    },
    {
      id: 'paypal_united',
      name: 'PayPal United Pay-in-4',
      product: 'paypal_pay_in_4',
      amountCleared: 107.96,
      dateCleared: '2026-08-13',
    },
    {
      id: 'affirm_textbook_misc',
      name: 'Affirm misc/textbooks',
      product: 'affirm_pay_in_4',
      amountCleared: 68.64,
      dateCleared: '2026-08-20',
    },
    {
      id: 'affirm_totalsem',
      name: 'Affirm totalsem.com',
      product: 'affirm_pay_in_4',
      amountCleared: 38.99,
      dateCleared: '2026-08-20',
    },
  ],
}
