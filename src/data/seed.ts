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

// Source of truth: the debt dump supplied 2026-09-14.
// Totals this data produces (verified against the source before seeding):
//   active             $12,363.81   ties to the source's grand total exactly
//   potential               $0.00   New Friend is now confirmed
//   income                  $0.00   unemployment ended Sep 2026; no rent owed
//   cleared to date     $1,641.56
//
// The source's tier 2 subtotal reads $1,322.01; its own rows sum to $1,521.48,
// $199.47 more. The grand total is the one that ties, so it is the one used.
//
// Five lender-stated final dates disagree with the arithmetic of their own
// balance and payment. Stored as supplied and surfaced by the Schedule check on
// the Calendar rather than silently corrected — only the lender can settle it:
//   Omio     stated 2027-08-29, computed 2027-07-29 (11 payments, not 12)
//   Atlanta  stated 2027-02-20, computed 2027-04-20 (8 payments, not 6)
//   Tokyo    stated 2026-11-03, computed 2027-01-03 (4 payments, not 2)
//   Klarna L stated 2026-10-06, computed 2026-10-09 (3 biweekly from Sep 11)
//   Klarna S stated 2026-09-25, computed 2026-10-09 ($80.82 is 3 payments, not 2)
//
// The four instalments that were past due at the time of the dump — AutoZone
// Sep 13, and Klarna large, Klarna small and EDC #1 on Sep 11 — have since been
// confirmed paid, $187.28 in total. They are left unflagged so the app settles
// them on load, which records each as a payment in history rather than quietly
// lowering a balance. After that pass:
//   active             $12,176.53
//   cleared to date     $1,676.31   (EDC #1 finishes on its Sep 11 payment)
// The balances below are the lender's last statement, before those four.
/**
 * Bump whenever the figures below change. Devices carrying an older stamp are
 * offered the update rather than silently keeping their copy: saved state
 * replaces the seed wholesale on load, so without this a reconciliation never
 * reaches a phone that has opened the app before.
 */
export const SEED_VERSION = '2026-09-17'

/**
 * The date the lender figures below were taken. Separate from the version,
 * which carries a suffix for revisions of the same table — formatting the
 * version as a date printed "Invalid Date" on every device that saw an update.
 * Payments logged by hand on or after this date are not in the table and are
 * re-applied when it is loaded.
 */
export const SEED_DATE = '2026-09-14'

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
      high: 9166,
      notes:
        'Jan 1–Jun 15, 2026 unpaid raise. Not yet filed. NC DOL complaint (free, 3–5 months) vs NC Small Claims (~$96 fee, 30–60 days, $10k cap). Preference: pursue full DOL path. Treated as upside, not a planning dependency.',
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
  // Rent is confirmed as nil — not an omission. Food, phone and transport have
  // not been supplied and are deliberately not guessed at: a made-up figure
  // would make the split look precise while being wrong.
  expenses: [],

  // Tier 0 — urgent · Tier 1 — ~36% APR · Tier 2 — 0% promo BNPL
  // Tier 3 — Apple Card · Tier 4 — personal / flexible
  debts: [
    {
      id: 'paypal_autozone',
      name: 'PayPal AutoZone',
      product: 'paypal_pay_monthly',
      status: 'active',
      priorityTier: 1,
      balance: 383.94,
      apr: 35.99,
      monthlyPayment: 34.91,
      nextDue: '2026-09-13',
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
      finalPaymentDate: '2027-08-29',
      notes:
        'Lender date stored as supplied. $579.57 at $52.70 is 11 payments, which run Sep 29, 2026 to Jul 29, 2027 — a month short of the stated date. Worth confirming with PayPal.',
    },
    {
      id: 'affirm_atlanta',
      name: 'Affirm SpringHill Suites Atlanta',
      product: 'affirm_pay_monthly',
      status: 'active',
      priorityTier: 1,
      balance: 289.91,
      apr: 36.0,
      monthlyPayment: 36.28,
      nextDue: '2026-09-20',
      finalPaymentDate: '2027-02-20',
      notes:
        'Lender date stored as supplied. $289.91 at $36.28 is 8 payments ending Apr 20, 2027; the stated Feb 20 date would only cover 6.',
    },
    {
      id: 'affirm_columbia',
      name: 'Affirm La Quinta Columbia',
      product: 'affirm_pay_monthly',
      status: 'active',
      priorityTier: 1,
      balance: 235.35,
      apr: 36.0,
      monthlyPayment: 26.17,
      nextDue: '2026-09-21',
      finalPaymentDate: '2027-05-21',
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
      nextDue: '2026-10-03',
      finalPaymentDate: '2026-11-03',
      notes:
        'One payment made since the last update. Lender date stored as supplied, but $213.80 at $53.45 is exactly 4 payments, ending Jan 3, 2027 — the stated Nov 3 date covers only 2.',
    },
    {
      id: 'affirm_airbnb_cousin',
      name: 'Affirm New Airbnb (cousin)',
      product: 'affirm_pay_monthly',
      status: 'active',
      priorityTier: 2,
      balance: 799.07,
      apr: 0,
      monthlyPayment: 133.28,
      nextDue: '2026-09-17',
      finalPaymentDate: '2027-02-17',
    },
    {
      id: 'klarna_ace_large',
      name: 'Klarna ACE Rent A Car (large)',
      product: 'klarna_pay_in_4',
      status: 'active',
      priorityTier: 2,
      balance: 272.04,
      apr: 0,
      monthlyPayment: 90.68,
      nextDue: '2026-09-11',
      finalPaymentDate: '2026-10-06',
      notes:
        'Lender date stored as supplied: three biweekly payments from Sep 11 land Oct 9, not Oct 6.',
    },
    {
      id: 'klarna_ace_small',
      name: 'Klarna ACE Rent A Car (small)',
      product: 'klarna_pay_in_4',
      status: 'active',
      priorityTier: 2,
      balance: 80.82,
      apr: 0,
      monthlyPayment: 26.94,
      nextDue: '2026-09-11',
      finalPaymentDate: '2026-09-25',
      notes:
        'The lender date moved to Sep 25, which covers exactly one payment. After the confirmed Sep 11 payment this stands at $53.88 — still two payments, ending Oct 9. For Sep 25 to be right a second payment must also have gone through, leaving $26.94.',
    },
    {
      id: 'klarna_flight',
      name: 'Klarna Flight and Tickets (Ohio)',
      product: 'klarna_pay_in_4',
      status: 'active',
      priorityTier: 2,
      balance: 223.47,
      apr: 0,
      monthlyPayment: 74.49,
      nextDue: '2026-09-30',
      finalPaymentDate: '2026-10-28',
      notes: 'New this update. Three biweekly payments from Sep 30 land Oct 28 — the dates reconcile.',
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
      notes: 'One instalment left. The date now reconciles — the earlier Oct 6/Oct 8 disagreement is resolved.',
    },
    {
      id: 'edco_tix_1',
      name: 'EDC Orlando Tickets #1',
      product: 'event_installment',
      status: 'active',
      priorityTier: 2,
      balance: 34.75,
      apr: 0,
      monthlyPayment: 34.75,
      nextDue: '2026-09-11',
      finalPaymentDate: '2026-09-11',
    },
    {
      id: 'edco_tix_2',
      name: 'EDC Orlando Tickets #2',
      product: 'event_installment',
      status: 'active',
      priorityTier: 2,
      balance: 58.48,
      apr: 0,
      monthlyPayment: 58.48,
      nextDue: '2026-09-25',
      finalPaymentDate: '2026-09-25',
    },
    {
      id: 'apple_card',
      name: 'Apple Card',
      product: 'credit_card',
      status: 'active',
      priorityTier: 3,
      balance: 7341.0,
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
      notes:
        'The supplied lines sum to $866.54. The summary alongside them read $548.68, which is exactly the running total before the final +$317.86 — so either that charge is new, or it does not belong. Delete it from the tab if it is the latter.',
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
      balance: 296.0,
      apr: 0,
      nextDue: '2026-09-25',
      notes: 'Confirmed in the Sep 14 update — no longer unconfirmed.',
    },
  ],

  clearedDebts: [
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
