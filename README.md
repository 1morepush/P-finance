# P-Finance

A personal debt payoff, income and savings tracker that installs to the home
screen from Safari or Chrome. It runs as a web app with no account and no
server.

**Live:** <https://1morepush.github.io/P-finance/>

## Your data stays on the phone

Everything lives in the browser's `localStorage` on the device, under the key
`p-finance/state/v2`. Nothing is uploaded. Settings has a JSON backup to
export and import, and the app says how long ago the last one was taken.

Screenshots read by **Update from screenshots** stay on the phone too. The
text-reading engine (tesseract.js) runs in the browser, and the app serves its
files itself, so reading a picture contacts no one. The picture is not kept.

The one exception is optional. **Bank balance from Stripe** reads a bank
balance through a small Cloudflare Worker that you deploy yourself. The worker
holds the Stripe secret key, so the key is never in the app. The app's access
token is kept apart from the rest of the data and never goes into a backup.
See [`worker/README.md`](worker/README.md).

## What it does

### Home

Home is for today: what is in the bank, what is safe to spend, and the
quickest ways to tell the app what happened. The rest folds away.

- **In the bank:** what is really there, and whether it is above the
  checking floor.
  - **Update balance** takes the available balance PNC shows.
    **📷 Screenshot** reads it from a screenshot, and Stripe pulls it once a
    bank is linked.
  - **Sent, not out yet** is for money you have sent that PNC has not taken.
    It comes off the balance at once, and the card shows what PNC still
    shows. Tap **It's out** when it posts, or **Didn't go** to put it back.
    Payments logged anywhere in the app can be marked the same way. Typing
    PNC's figure takes these off for you.
- **A warning card**, only when a payment is past due or the next 14 days
  take more than the bank holds, split around payday.
- **Safe to spend:** the bank, less the floor, less everything due before
  the next paycheck, less food and gas until then. "How this is worked out"
  lists each piece. Food, gas, phone and car insurance are entered here and
  saved as living costs.
- **Apple Card payoff** (whichever debt charges the highest interest):
  this month's progress toward $300, what can go on it today without
  touching the floor or the bills, a quick way to log a payment, and when it
  ends at the minimum, at $300 a month, and with the $5,250 reimbursement.
- **Car costs coming up**, while one is unpaid.
- **Tell it what you did:** type a plain sentence ("paid 50 toward Apple
  Card", "doordash 120, 25 gas, 4 hours", "bank balance is 812") and the app
  records it. The 📷 reads screenshots of the bank, the Apple Card, or a plan
  in Affirm, Klarna or PayPal, and shows each figure before anything changes.
- **Sunday check-in**, on Sundays.
- Folded sections that remember how you left them: **This week's bills**
  (a year of weeks), **To do**, **Log a paycheck** (with a suggested split)
  and **Runway**.

The 🔍 in the header is **Find**: type what you are looking for ("gas",
"Liv", "backup") and it opens the right tab, unfolds the section and scrolls
to it.

### Debts

What you owe, and the plan to clear it.

- **Paid off** on each debt clears it in one go. The amount starts at what
  settling today should cost (less than the balance for a loan whose future
  interest drops away) and can be changed to the lender's payoff quote. It
  asks whether the money came out of PNC checking. The debt moves to the
  paid-off list either way, and the payment can be undone from Logged
  payments, which puts the full balance back.
- **Summary:** the total, the split by kind, what is paid off so far, and the
  **Progress** chart.
- **Needs fixing**, shown only when something is wrong: a plan with no due
  date, a tab whose lines don't add up to its balance, or a final date that
  doesn't fit the schedule. Tap one to fix it.
- **The list**, three ways:
  - **By priority:** tiers for urgent, ~36% installment loans, 0% pay-later
    plans, the Apple Card, and money owed to people. Within a tier, debts at
    the same rate (to the whole percent) are ordered by how much monthly cash
    paying one off frees for each dollar it takes, so Affirm Tokyo and the
    Airbnb loan come first among the ~36% loans, as the recovery plan says.
    The first debt is marked as the next target.
  - **By lender:** each lender's total and next payment.
  - **People:** a line-by-line tab per person.
- **Payoff plan** (folded until opened):
  - The order extra money goes in (Tier, Avalanche or Snowball), and **what
    each one costs**.
  - **What the numbers say**: notes on what is coming up and where extra money
    helps most.
  - **Clear everything today**: what settling now would save.
  - **What if I paid more**: how much sooner the card clears with extra.
  - **Apple Card payoff projection**: the interest it costs to carry.
  - **When each debt finishes**, at current payments.
- **History** (folded until opened): the **Cleared** list, including any debt
  that was forgiven, and **logged payments**, which can be undone.
- A missed installment can be marked as pushed to a later date.

### Calendar

- **In the bank by Saturday:** today's bank balance, less everything due
  through Saturday (anything past due included, unconfirmed debts left out,
  planned costs at the top of their range), plus each paycheck on its
  payday. Under each week's total in the grid, a second figure carries it
  forward week by week, red when it goes below zero.
- Month grids stack as you scroll. Each week row is shown in full, so days
  from the next or previous month appear faded, labelled with their month.
- Beside each Sunday is what that week still owes, Sunday to Saturday,
  counting the neighbouring month's days in the row. A week already paid
  shows a tick and what went out.
- Every due date is shown: installments, the card minimum, and subscriptions
  on their billing day.
- Tap a day to see what is due and log a payment.
- **Add the next year of payments to my phone's calendar** saves the due
  dates as an `.ics` file for Apple or Google Calendar.

### Income

- **Income sources** and a log of income entered.
- **Potential upside** lists money that may come in, such as the wage claim
  and tuition reimbursement. It is not counted in the plan.
- **FedEx paycheck estimate** takes the hourly rate and hours, including
  overtime. It works out federal, Social Security, Medicare and NC tax on
  2026 rates, and the take-home per check.
- **Where the paycheck goes** covers bills, then living costs, then the rest.
  When the paycheck falls short, it says how many DoorDash hours or Depop
  sales close the gap.
- **Gig work:**
  - A shift log records earnings, gas and hours.
  - Miles come from the car's trip meter. If no trip reading is entered, the
    app estimates miles from the dash range readings and marks them as
    estimated.
  - Readings taken before and after a gas stop mid-dash are handled.
- **Gas:** a fill-up calculator for the 2010 Acura TL, and each shift's share
  of the tank.
- **Tax time** totals the year's gross, gas, net and mileage deduction.
- **Mileage log:**
  - Each shift can carry odometer readings at the start and end, where the
    driving was, and whether the work was paid as 1099 or W-2.
  - Only 1099 miles count toward the deduction. W-2 miles are logged but not
    counted, and commuting is not logged.
  - Miles are priced at the IRS rate on the day they were driven. For 2026
    that is 72.5¢ through June 30 and 76¢ from July 1.
  - The card shows how much of the log rests on odometer readings, the trip
    meter or range estimates.
  - **Save CSV** exports the log with the year's total. **View / print log**
    shows a plain page to print or save as a PDF.
- **Living costs** accept a next-due date, which puts them on the calendar.
- **Depop shop:**
  - Each item gets an id in the plan's sheet style (D001, D002, …), with
    brand, item, size, tag, list and floor prices, and the date listed.
  - Pricing help from the plan's tag-price table, and a suggested floor of
    about 15% below the list price.
  - **Copy title and description** fills in the plan's listing template.
  - Marking an item sold works out Depop's fees (3.3% of the buyer's total,
    shipping included, plus $0.45) and the net. The net can go into the bank
    balance and income log, and comes back out if the sale is undone.
  - Nudges at 14 days listed (new cover photo, then 10% off) and 30 days
    (bundle it, or move it to Facebook Marketplace).
  - **Export the tracking sheet** writes a CSV in the plan's columns.
  - The plan's Depop guide (setup, pricing, fees, shipping, shot list,
    listing and weekly routine) sits folded underneath.

### Plan

The money plan, rewritten Nov 14, 2026 after every loan that charged
interest was paid off: keep $1,500 in PNC, put $300 a month on the Apple
Card, and send the $5,250 reimbursement to the card when it lands. A phone
still on the first plan's $300 floor is moved to $1,500 once; a floor set by
hand is kept.

- **Apple Card payoff**, the same card as on Home.
- **The to-dos by phase:** Now (Nov 14-30), December, and January to March.
  The current phase is open, ticks are dated, and anything overdue is marked.
- **When the $5,250 lands:** the three-step order, to tick off.
- **Sunday check-in:** seven items that reset every Sunday.
- **Saving:**
  - The checking floor, built in steps to $1,500.
  - Sinking funds (car $20 a week now, fun $10 a week once the floor is
    reached). Moving money in takes it out of the PNC balance.
  - How to split each paycheck, and the split for after the debt is gone.
- **Cost cutters**, **Earning more** (with the job links), **Money that's
  coming** and **The rules**.

### Settings

Reached from the ⚙ in the header.

- The checking floor, $300 to start.

- The savings rate and the share kept in checking.
- **Backup & restore.**
- **Bank balance from Stripe** (optional, described above).
- **App version**, with the release history.

## Versions and figures

The app uses two separate stamps.

- **App version** (`src/version.ts`) follows MAJOR.MINOR:
  - MAJOR for something that could not be done before.
  - MINOR for fixes, refinements and figure updates.

  The header shows the version. After an update, a banner lists what changed
  since the last version this device saw. Add new releases to the top of
  `RELEASES` and never renumber one that has shipped.
- **Figures** (`src/data/seed.ts`) are the reconciled balances, due dates and
  income. The seed is only the starting point, since the phone keeps its own
  copy. When `SEED_VERSION` changes, the phone offers **Load new figures**.
  That replaces the debts, the cleared list, income sources and claims. It
  refreshes the seeded living costs and keeps any added on the device. It
  keeps the bank balance, savings, logged payments, shifts and settings. Any
  payment logged by hand on or after `SEED_DATE` is re-applied to the new
  balances. The comment at the top of `seed.ts` records where each figure
  came from and which of the source's figures were left out, and why.

## Development

```bash
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run build` | Type-checks the app (`tsc -b`) and builds to `dist/` |
| `node scripts/copy-ocr.mjs` | Copies the OCR engine from `node_modules` to `public/ocr` (not committed). Runs automatically before `dev` and `build`. |
| `npm run lint` | oxlint |
| `npm run preview` | Serves the built `dist/` locally |
| `npx tsc -p tsconfig.app.json --noEmit` | Type-checks the app on its own. A bare `npx tsc --noEmit` checks nothing, because the root `tsconfig.json` has `"files": []`. |

Stack: Vite, React 19, TypeScript, Tailwind 4, and `vite-plugin-pwa`, which
updates the phone automatically when a new build is deployed.

### Layout

```
src/
  pages/        one file per tab: Dashboard, Debts, Calendar, Income, Plan, and Settings
  components/   cards and forms
  lib/          the logic: schedules, weeks, payoff strategies, tax, fuel, storage,
                and screenshot reading (ocr.ts runs the engine; screenshot.ts turns
                the words into figures and matches them to your plans)
  data/seed.ts  the reconciled figures
  data/recoveryPlan.ts  the recovery plan's to-dos, tables and rules
  version.ts    release history
worker/         the optional Stripe bank-balance worker (Cloudflare)
scripts/        icon generation, and copying the OCR engine into public/ocr
```

## Deploying

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every
push to `main`. Pull requests are not built.

To set it up once, go to **Settings → Pages → Build and deployment → Source**
and choose **GitHub Actions**.

To install on an iPhone, open the Pages URL in Safari and choose **Share → Add
to Home Screen**.

The Vite `base` in `vite.config.ts` is `/P-finance/` to match the Pages URL.
If the repo is renamed, change it to match. Each build carries a stamp (build
time and commit), shown in the app, so you can confirm which build a phone is
running.
