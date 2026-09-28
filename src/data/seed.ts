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

// Source of truth: the status supplied 2026-09-28.
// Totals this data produces (verified against the source before seeding):
//   active             $12,263.00   the source's $11,955.14, plus $307.86 below
//   of which estimated  $1,181.45   Atlanta, Columbia, Airbnb, Delta
//   cleared to date     $1,734.79   the source's $1,864.79, less $130 below
//
// Two of the source's figures are not used, both deliberately:
//
//   Himeth $548.68 and Liv $378.08. These are exactly the running totals from
//   before the Sep 17 correction — $866.54 − $317.86 and $368.08 + $10 — which
//   was confirmed at the time as $866.54 and $368.08. The status repeated the
//   old figures; it did not report a payment. Kept at the confirmed amounts,
//   which is where the $307.86 difference comes from.
//
//   New Friend's $130 as a cleared debt. It is a part-payment, recorded as a
//   line on that tab ($296 → $166); the cleared log is for debts paid off,
//   and listing it in both would count it twice.
//
// Every instalment balance ties to its payment × payments left within Affirm's
// usual rounding (61¢ at most), and the tier subtotals tie to the total.
//
// "Estimated" in the source means the September autopay has not been seen to
// post, not that the debt is uncertain. Those four stay active and counted;
// email was checked and holds reminders for them, not receipts.
//
// Tokyo's next payment moved from Oct 3 to Nov 3 with no change in balance,
// and nothing in email explains it. Taken as supplied, since the source marks
// it confirmed, and flagged on the debt: if Affirm still shows Oct 3, $53.45
// is due then.
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
export const SEED_VERSION = '2026-09-28'

/**
 * The date the lender figures below were taken. Separate from the version,
 * which carries a suffix for revisions of the same table — formatting the
 * version as a date printed "Invalid Date" on every device that saw an update.
 * Payments logged by hand on or after this date are not in the table and are
 * re-applied when it is loaded.
 */
export const SEED_DATE = '2026-09-28'

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
  // Google Photos is billed $29.99 a year; a year is not a cadence the app
  // has, so it is carried as the $2.50 a month it averages.
  expenses: [
    { id: 'exp-claude', name: 'Claude Pro', amount: 20, cadence: 'monthly', essential: false },
    { id: 'exp-icloud', name: 'iCloud+ 2TB', amount: 9.99, cadence: 'monthly', essential: false },
    { id: 'exp-google-photos', name: 'Google Photos 200GB (yearly $29.99)', amount: 2.5, cadence: 'monthly', essential: false },
    { id: 'exp-anytime-fitness', name: 'Anytime Fitness', amount: 25, cadence: 'biweekly', essential: false },
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
      balance: 579.57,
      apr: 35.99,
      monthlyPayment: 52.7,
      nextDue: '2026-09-29',
      finalPaymentDate: '2027-07-29',
      notes:
        '$579.57 at $52.70 is 11 payments, Sep 29, 2026 to Jul 29, 2027. The Sep 28 status uses that date, settling the month-short question.',
    },
    {
      id: 'affirm_atlanta',
      name: 'Affirm SpringHill Suites Atlanta',
      product: 'affirm_pay_monthly',
      status: 'active',
      priorityTier: 1,
      balance: 253.63,
      apr: 36.0,
      monthlyPayment: 36.28,
      nextDue: '2026-10-20',
      finalPaymentDate: '2027-04-20',
      notes:
        'Shown in Affirm as the Hotels.com plan: $36.28 due on the 20th. $253.63 is 7 payments ending Apr 20, 2027, the date the Sep 28 status now carries. Estimated: the September autopay has not been seen to post — Affirm and PayPal emailed reminders, not receipts. Confirm from the lender app or a bank statement.',
    },
    {
      id: 'affirm_columbia',
      name: 'Affirm La Quinta Columbia',
      product: 'affirm_pay_monthly',
      status: 'active',
      priorityTier: 1,
      balance: 209.18,
      apr: 36.0,
      monthlyPayment: 26.17,
      nextDue: '2026-10-21',
      finalPaymentDate: '2027-05-21',
      notes:
        '$209.18 at $26.17 is 8 payments ending May 21, 2027. Estimated: the September autopay has not been seen to post — Affirm and PayPal emailed reminders, not receipts. Confirm from the lender app or a bank statement.',
    },
    {
      id: 'affirm_tokyo',
      name: 'Affirm Hotel Keihan Tokyo',
      product: 'affirm_pay_monthly',
      status: 'active',
      priorityTier: 1,
      balance: 213.8,
      apr: 36.0,
      monthlyPayment: 53.45,
      nextDue: '2026-11-03',
      finalPaymentDate: '2027-02-03',
      notes:
        'The Sep 28 status moves the next payment from Oct 3 to Nov 3 with the balance unchanged at $213.80 (4 × $53.45, ending Feb 3, 2027). Nothing in email explains the move. If Affirm still shows Oct 3, $53.45 is due then and this date is wrong — check the Affirm app.',
    },
    {
      id: 'affirm_airbnb_cousin',
      name: 'Affirm New Airbnb (cousin)',
      product: 'affirm_pay_monthly',
      status: 'active',
      priorityTier: 2,
      balance: 665.79,
      apr: 0,
      monthlyPayment: 133.28,
      nextDue: '2026-10-17',
      finalPaymentDate: '2027-02-17',
      notes:
        '$665.79 is 5 payments of $133.28 ending Feb 17, 2027. Estimated: the September autopay has not been seen to post — Affirm and PayPal emailed reminders, not receipts. Confirm from the lender app or a bank statement.',
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
      id: 'delta_airlines',
      name: 'PayPal Delta Airlines',
      product: 'paypal_pay_in_4',
      status: 'active',
      priorityTier: 2,
      balance: 52.85,
      apr: 0,
      monthlyPayment: 52.85,
      nextDue: '2026-10-08',
      finalPaymentDate: '2026-10-08',
      notes:
        'One payment left: $52.85 on Oct 8. Estimated: the September autopay has not been seen to post — Affirm and PayPal emailed reminders, not receipts. Confirm from the lender app or a bank statement.',
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
