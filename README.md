# P-Finance

A personal debt payoff, income and savings tracker that installs to the home
screen from Safari or Chrome. It runs as a web app with no account and no
server.

**Live:** <https://1morepush.github.io/P-finance/>

## Your data stays on the phone

Everything lives in the browser's `localStorage` on the device, under the key
`p-finance/state/v2`. Nothing is uploaded. Settings has a JSON backup to
export and import, and the app says how long ago the last one was taken.

The one exception is optional. **Bank balance from Stripe** reads a bank
balance through a small Cloudflare Worker that you deploy yourself. The worker
holds the Stripe secret key, so the key is never in the app. The app's access
token is kept apart from the rest of the data and never goes into a backup.
See [`worker/README.md`](worker/README.md).

## What it does

### Home

- **Tell it what you did.** Type a plain sentence and the app records it.
  Examples: "paid 50 toward Omio", "doordash 120, 25 gas, 4 hours",
  "I owe Sam 150", "bank balance is 812". It can log a payment, income, a
  shift or a new debt.
- **Week cost card.** Swipe through the next 52 weeks, Sunday to Saturday.
  Each week shows debt payments and subscriptions on the days they come out,
  plus a weekly share of costs that have no date. It also shows what is still
  left to cover this week.
- **Runway**, a **Progress** chart, and **What the numbers say**: notes on
  overdue payments, debts with no due date, and what is coming up.
- **Log this week's income**, with a suggested split between debt, extra
  payoff, savings and money kept in checking.
- **Apple Card payoff projection** estimates the interest at the current
  payment.
- **Potential upside** lists money that may come in, such as the wage claim
  and tuition reimbursement. It is not counted in the plan.

### Debts

- Debts are grouped into priority tiers: urgent, ~36% installment loans, 0%
  pay-later plans, the Apple Card, and money owed to people. Debts with no
  due date are listed under **Needs a due date**.
- A **By lender** roll-up totals each lender.
- **Logged payments** can be undone. A missed installment can be marked as
  pushed to a later date.
- **Owed to people** keeps a line-by-line tab per person, and flags any tab
  whose lines don't add up to its balance.
- **What if I paid more** shows how much sooner a debt clears with extra
  payments.
- The **Cleared** list keeps everything already paid off, including any debt
  that was forgiven.

### Calendar

- Month grids stack as you scroll. Each week row is shown in full, so days
  from the next or previous month appear faded, labelled with their month.
- Every due date is shown: installments, the card minimum, and subscriptions
  on their billing day.
- Tap a day to see what is due and log a payment.
- **Add the next year of payments to my phone's calendar** saves the due
  dates as an `.ics` file for Apple or Google Calendar.

### Income

- **Income sources** and a log of income entered.
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
- **Living costs** accept a next-due date, which puts them on the calendar.

### Settings

- The payoff strategy, savings rate and share kept in checking.
- **What each one costs** compares the Tier, Avalanche and Snowball payoff
  orders.
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
| `npm run lint` | oxlint |
| `npm run preview` | Serves the built `dist/` locally |
| `npx tsc -p tsconfig.app.json --noEmit` | Type-checks the app on its own. A bare `npx tsc --noEmit` checks nothing, because the root `tsconfig.json` has `"files": []`. |

Stack: Vite, React 19, TypeScript, Tailwind 4, and `vite-plugin-pwa`, which
updates the phone automatically when a new build is deployed.

### Layout

```
src/
  pages/        one file per tab: Dashboard, Debts, Calendar, Income, Settings
  components/   cards and forms
  lib/          the logic: schedules, weeks, payoff strategies, tax, fuel, storage
  data/seed.ts  the reconciled figures
  version.ts    release history
worker/         the optional Stripe bank-balance worker (Cloudflare)
scripts/        icon generation
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
