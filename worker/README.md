# Bank-link worker

The app is public static files, so it can't hold a Stripe secret key. This
one-file worker holds it instead. It opens Stripe's bank-linking screen and
reads back balances. It stores nothing.

```
phone (P-Finance)  ──token──▶  this worker  ──secret key──▶  Stripe  ──▶  your bank
```

Your bank login happens on Stripe's screen. The app and the worker only ever
see the balance.

## Setup (about 15 minutes, all free in test mode)

### 1. Stripe: get test keys

1. Sign up at <https://dashboard.stripe.com/register>.
2. Make sure the **Test mode** toggle is on.
3. **Developers → API keys**. Copy both:
   - Publishable key: `pk_test_…`
   - Secret key: `sk_test_…` (treat it like a password)

### 2. Make an access token

This is the password between your phone and the worker. Make one that is **at
least 24 characters**, random, and not reused anywhere. A password manager's
generator is fine. So is `openssl rand -hex 24`.

### 3. Cloudflare: deploy the worker

**No terminal (browser only):**

1. Sign up at <https://dash.cloudflare.com/sign-up>.
2. **Workers & Pages → Create → Create Worker**. Name it `p-finance-bank`, then **Deploy**.
3. **Edit code**. Replace everything with the contents of `bank-link.js`, then **Deploy**.
4. **Settings → Variables and Secrets → Add**. Add three values, each as type **Secret**:

   | Name | Value |
   |---|---|
   | `STRIPE_SECRET_KEY` | `sk_test_…` |
   | `STRIPE_PUBLISHABLE_KEY` | `pk_test_…` |
   | `APP_TOKEN` | your token from step 2 |

5. Copy the worker's URL, e.g. `https://p-finance-bank.<you>.workers.dev`.

**Or with a terminal**, from this folder:

```sh
npx wrangler login
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_PUBLISHABLE_KEY
npx wrangler secret put APP_TOKEN
npx wrangler deploy
```

### 4. In the app

**Settings → Bank balance from Stripe**. Paste the worker URL and your token,
then **Save**, then **Link a bank account**. In test mode Stripe offers pretend
banks: pick one and you'll see a test balance.

The token is kept on that phone only and is **not** included in backups.

## Real bank (live mode)

Test mode never touches a real account. To link your actual bank:

1. Activate your Stripe account (Stripe asks for business details).
2. Register for Financial Connections: **Dashboard → Settings → Financial Connections**.
   Stripe reviews this and **may decline** a personal-use registration.
3. Swap the two Stripe secrets for the `sk_live_…` / `pk_live_…` keys.

Live pricing isn't published; Stripe quotes it on request. Cloudflare's free
tier covers 100,000 requests a day, far beyond one person.

## What it will and won't do

- **Asks your bank for balances only.** Not transactions, not owner details.
  Stripe shows you exactly this on its consent screen.
- Answers only the app's own web address and requests carrying the token.
  It refuses to start at all if the token is under 24 characters.
- Keeps no data. Delete the worker and nothing remains except the linked
  accounts in your Stripe dashboard, which you can disconnect there.
