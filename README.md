# P-Finance

A personal income, debt payoff, and savings tracker — installable straight from
Safari or Chrome as a home-screen app. All data stays on your device (browser
`localStorage`); nothing is sent to a server.

## What it does

- **Dashboard** — enter your current bank balance and log this week's income.
  The app suggests a split: this month's minimum debt obligations (spread
  evenly across the weeks in a month), extra toward your highest-priority
  debt, and a cut for savings — with one-tap buttons to apply either.
- **Debts** — add, edit, or remove debts (installment plans, revolving credit,
  personal loans). Ordered automatically by your chosen strategy.
- **Income** — track income sources (job, unemployment, freelance, etc.) and a
  log of income you've entered.
- **Settings** — switch between avalanche (highest APR first) and snowball
  (smallest balance first) payoff strategies, tune your savings rate, and
  export/import a JSON backup.

The app ships seeded with an initial set of debts/income so it's useful
immediately — edit or delete anything from the Debts/Income tabs.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Outputs to `dist/`.

## Deploying to GitHub Pages

A workflow at `.github/workflows/deploy.yml` builds and deploys `dist/` on
every push to `main`. To turn it on:

1. In the repo, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or run the workflow manually from the Actions tab).

Once deployed, open the Pages URL in Safari on your phone and use
**Share → Add to Home Screen** to install it like an app.

The Vite `base` path in `vite.config.ts` is set to `/p-finance/` to match this
repo's GitHub Pages URL. If you rename the repo, update that value to match.
