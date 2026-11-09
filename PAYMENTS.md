# Online payments and the store (Moyasar), staging first

Built 2026-11-10 at the user's request: "implement the store and experiences in the staging website and anything
that has payment". Everything here runs on staging.micromobility.sa against the staging database first. Live
stays as it is until the owner decides (the owner answered "no" to online prepayment on 2026-10-24).

## What takes money online

| What | Where | Held while paying | Paid means |
|---|---|---|---|
| Store order | /store, /store/checkout | its stock, `store.orderMinutes` (30) | order `paid`, invoice number |
| Ride booking (paid rides) | /experiences review step | the places, `pay.holdMinutes` (15) | rows `paid`, `pay_method 'online'` |
| Unpaid booking ("Pay now" on a ticket) | /account | nothing | the same |
| Locker | /lockers, "Pay by card now" | the lockers, 15 min | rental `receipt_id 'pay-<id>'` |
| Wallet top-up (switch `pay.topup`, off) | /account wallet card | nothing | wallet `topup`, method `online` |
| Workshop job (final price set, ready/done) | /workshop tracker | nothing | job `paid_at` |

Never online: free rides, races (Victory Lap, Arena Heros: the organiser's money, by transfer), Petromin nights
(the company's bill or the desk), on-the-house and VIP rows (nothing to pay).

## How a payment works (and why it is safe)

1. The page asks this site's server to start a payment (`/api/booking`, `/api/store/checkout`, `/api/pay/*`). The
   database writes a `payments` row with the amount it computed itself (`pay_*_start`, `store_checkout`) and holds
   what is being bought. The browser never sends a price.
2. `/pay/<id>` shows what is paid, the total, the hold's countdown, the refund policy (before the button, Saudi
   E-Commerce Law art. 7) and Moyasar's own form (moyasar-payment-form 2.3.1 from jsDelivr, pinned in the CSP).
   The card goes straight from the browser to Moyasar with the publishable key; this site never sees it (PCI). The
   form carries `metadata.pay_id` and a fresh `given_id` (Moyasar's idempotency key), and `apply_coupon: false`.
3. After 3-D Secure (or at once for Apple Pay and STC Pay) Moyasar sends the rider to `/api/pay/return`. The
   status in that address is never believed: the server fetches the payment from Moyasar with the secret key and
   calls `pay_settle`, which checks it is ours, in SAR, for exactly our amount, then applies it. Idempotent.
4. The same happens from Moyasar's webhook (`/api/pay/webhook`, secret token compared in constant time, then the
   payment fetched again) and from the reconcile run every 5 minutes (worker.js `scheduled`), which asks Moyasar
   for every payment carrying an unpaid `pay_id`. Whichever comes first settles it; the others change nothing.
5. pg_cron `mm-pay-tick` (every minute) expires a payment 2 minutes after its hold and lets go of what it held
   (bookings cancelled with `cancel_reason 'unpaid'`, stock put back, lockers freed). Money that arrives later is
   applied when the place / stock / locker is still free, else refunded automatically.
6. Refunds: a rider cancelling a booking paid online at least `pay.refundDays` (1) before the ride day chooses
   wallet (at once) or card (sent to Moyasar now). Any other cancel of an online-paid booking or locker writes a
   refund "due" that staff decide in the staff page (Payments > Refunds). Card refunds always go through this
   site's server (`/api/pay/refund`), the only holder of the secret key; the database checks the staff member
   (admin, refund right, PIN, manager limit). Paid twice, wrong amount, or no longer held: refunded by the system.

The website's server reaches the database's money functions with its own key (`PAY_SERVER_KEY`); the database
keeps only its SHA-256 (`pay_server_keys`). The public key alone opens none of them.

## Settings staff control (site_content; staff page > Payments > Settings)

`pay.enabled` (master switch), `pay.bookings` (`required` | `optional` | `off`), `pay.holdMinutes` (15),
`pay.refundDays` (1), `pay.topup` (false), `pay.topupMin` / `pay.topupMax` (20 / 1000), `store.open`,
`store.orderMinutes` (30), `store.discountLicence` (shows "was" prices only when set), `store.delivery`
(`pickup` free, `jeddah` 30 SAR 1-2 days, `ksa` 45 SAR 4-7 days, free over 500: placeholders for the owner).
The hourly live-to-staging copy never touches `pay.*` and `store.*` (scripts/staging-sync.mjs).

## Setting up Moyasar on staging (once)

1. Create the Moyasar account (moyasar.com). The test keys are in Settings > API Keys right away: `pk_test_...` and
   `sk_test_...` (the secret one is shown once).
2. Server key for the database: in a terminal, generate it into the repository secrets and print its hash:
   `KEY=$(openssl rand -hex 32); printf '%s' "$KEY" | gh secret set STAGING_PAY_SERVER_KEY -R ahmadbMM/mm-platform; printf '%s' "$KEY" | shasum -a 256; unset KEY`
   then in the STAGING project's SQL editor: `insert into public.pay_server_keys (key_hash, label) values ('<the printed hash>', 'staging website');`
3. Repository secrets (GitHub > ahmadbMM/mm-platform > Settings > Secrets and variables > Actions):
   `STAGING_MOYASAR_PUBLISHABLE_KEY` (pk_test_...), `STAGING_MOYASAR_SECRET_KEY` (sk_test_...),
   `STAGING_MOYASAR_WEBHOOK_SECRET` (any long random text, also typed into Moyasar below). The next staging deploy
   uploads them to the Worker (CI "Payment keys for staging").
4. Moyasar dashboard > Settings > Webhooks > Add: URL `https://staging.micromobility.sa/api/pay/webhook`, method POST,
   Secret Token = the same text as `STAGING_MOYASAR_WEBHOOK_SECRET`, events: payment_paid, payment_failed,
   payment_refunded, payment_voided (or all).
5. Apple Pay (optional on staging): Moyasar dashboard > Settings > Apple Pay Domains > add `staging.micromobility.sa`
   > Download Association > put the file's whole text in the repository secret `STAGING_APPLE_PAY_DOMAIN_FILE` >
   deploy > Validate > Register. Each host is registered on its own (later: `micromobility.sa`, `www.micromobility.sa`).
6. STC Pay: ask Moyasar to enable it (care@moyasar.com or the account manager).
7. Cloudflare Access: staging is public (noindex). Moyasar's webhook and return must reach `/api/pay/*`; if Access is
   switched on later, exempt `/api/pay/webhook`.

## Testing (test keys: no real money)

- Cards (any name of two words, any future expiry, any 3-digit CVC): mada `4201320111111010` paid,
  `4201320000311101` insufficient funds; Visa `4111111111111111` paid (3-D Secure), `4111114005765430` frictionless;
  Mastercard `5421080101000000` paid; declines: `4201321234411220` (mada declined), `5204730000002514` (MC declined).
- STC Pay: any 05 mobile, OTP `123456` paid, `111111` insufficient balance.
- Apple Pay in test mode: a real card in Wallet on a real device; only amounts from 200 to 300 SAR succeed.
- Things to try: pay a ride (hold countdown, decline then success), let a hold run out (place released, then pay
  late), cancel before the ride day to wallet and to card, cancel on the ride day (no refund), store order guest +
  signed in + wallet part, KSA delivery without a short address (refused), workshop Pay, locker by card, top-up
  (switch on first), staff refund from the staff page.

## Before live (owner and accountant)

- Owner: online prepayment on live (answered "no" 2026-10-24), delivery prices and areas, store opening.
- Accountant / lawyer: ZATCA phase 1 invoice wording for online receipts, VAT on wallet top-ups (stored value; SAMA
  permission), the Terms' refund clause (switch the Terms page on), whether rides are exempt from the 7-day rescission
  (rental / event services), a Ministry of Commerce discount licence before any "was" price.
- Moyasar activation: they review products, images, prices, policies (terms, refunds, delivery, complaints handling
  time) and contact details before live keys; register `micromobility.sa` and `www` for Apple Pay; live keys go in
  production secrets the same way (`MOYASAR_*` without the STAGING_ prefix, to be added to the production deploy step).
