# micromobility.sa/lockers

The lockers page (the owner, 2026-11-09: "customers who dont have an account to be able to sign up when scanning the
qr code of ... micromobility.sa/lockers to reserve a locker ... choose the locker they want from a dynamic lockers
distribution that simulates how it look in real life it has 3 columns and 6 rows total of 18 lockers"). A rider picks
an evening, a time and up to three lockers on a drawing of the cabinet, signs in or makes an account, and pays from the
wallet now or at the desk when the key is collected. One self-contained page that the website (`apps/web`) serves at
that address, outside Coming Soon, built the way `forms/saturday` is.
In the website's sixteen languages (`?lang=`; Arabic and Urdu right to left), light and dark as the device is set. The
website draws it as one of its own pages (`apps/web/src/app/[locale]/<address>`: the site's header, footer and language
menu around it, its scripts run by the page; `forms/shared/site-form.mjs`); `?classic=1` answers with the page built on
its own, whose header has a menu of the sixteen languages (the user, 2026-11-09).

## What it does, in order

1. **The evening, the time and the cabinet**, before any sign-in. `locker_evenings(p_id?, p_token?)`: tonight and the
   coming evenings that offer lockers, with the prices (`one`, `both`); a Petromin night only for a rider signed in and
   booked on it (the page asks again with the session once signed in). The times: on a circuit evening 6-8 PM
   (`early`), 9-11 PM (`late`) or 6-11 PM (`both`); on a Petromin night 7-9 PM (`pm`). A time that is over
   (`ended`) is not offered, a time with none left (`left`) is shut ("Full"). `locker_board(p_day)` draws the cabinet:
   three columns, numbered across the rows (locker n in row ceil(n/3), column ((n-1)%3)+1: 1-2-3 on top, 16-17-18 at
   the bottom), left to right in Arabic too, as the real one stands; a number missing leaves its place empty. A door
   is free, picked (up to three; a tap again puts it back), taken for that time (a padlock; never who has it) or out of
   service (a cross). A time covers the slots `early` e, `late` l, `both` and `pm` e+l. The board is read again when
   the evening or the time changes and every 15 seconds while the page is seen and on Continue; a picked locker taken meanwhile is
   dropped and said. A signed-in rider's own lockers count towards the three (`LOCKER_LIMIT`).
2. **The account**, when not signed in: the booking site's own sign-up and sign-in, exactly as `forms/saturday` asks
   them (the phone's country codes without flags: no emoji). A forgotten password goes through the booking app
   (`?handoff=lockers&lang=&auth=forgot`), which sends the rider back to `/lockers?code=<one-time code>`; the lockers
   picked wait in this tab's sessionStorage (`mm-lockers-pick`: the evening, the time, the numbers), which also keeps
   them across a reload. There is no "Your details" step: a locker needs only the account.
3. **Review and pay**: the lockers, the evening, the time and the total, then how to pay. **Pay from wallet** shows the
   balance (`customer_wallet`; hidden when it answers nothing) and is shut when the balance is less than the total or
   on a Petromin night (the company's bill); **Pay at the desk** is chosen already when the wallet is out of reach.
   `customer_locker_book(p_id, p_token, p_day, p_period, p_codes, p_pay)`. Its refusals each have their words:
   `LOCKER_TAKEN: n` (back to the cabinet, read again, "Locker n was just taken"), `LOCKERS_FULL`, `LOCKER_LIMIT`,
   `LOCKER_NOT_OPEN`, `LOCKER_OUT: n`, `LOCKER_UNKNOWN: n`, `LOCKER_PICK`, `LOCKER_PAY`, `WALLET_SHORT`,
   `WALLET_NOT_OPEN`, `NOT_AUTHORIZED` (sign in again).
4. **Reserved**: the numbers, the evening, the time, the total and how it is paid ("Paid from your wallet" / "Pay at
   the desk when you collect the key"), then **Your lockers** (`customer_lockers`: from today on, reserved or in use).
   One with no booking behind it and not yet collected has **Remove**, which asks first in a pop-up centred on the
   screen (saying the wallet payment comes back, when there was one) and calls `customer_locker_drop`. **Reserve
   another** goes back to the cabinet. Your lockers shows on the cabinet's page too while signed in.

A locker's own tag or QR label, `micromobility.sa/lockers/7` (a tag written before the lockers lost their L,
`/lockers/L7`), is answered by the website's proxy (`apps/web/src/proxy.ts`): a staff phone goes on to
`staff.micromobility.sa/?locker=7`, a rider's to `/lockers?locker=7`, where that locker is picked on the first evening
and time it is free (an L and leading zeros are read past: L7, 07 and 7 are one locker).

Database: `20261109220000_locker_page.sql` in the booking site repo (`locker_evenings`, `locker_board`,
`customer_locker_book`, `customer_locker_drop`, `customer_lockers`; lockers 1 to 18), on top of
`20261109120000_lockers.sql`. The prices are staff's (Settings > Business > Lockers); the page shows what the database
answers.

## Where things come from
- `design/` — the page: `index.html`, `styles.css` (MicroMobility's green, the Saturday page's palette, and the
  cabinet), `app.js`, `i18n.js` (its own strings in Arabic, keyed by the English; the lockers' words are the booking
  app's where it has them), `mm-lockup.svg` (drawn inline, so its words follow the text colour), `favicon.png`. The
  fonts are the website's files (`apps/web/public/fonts/forms`), and the riyal sign is the site's own
  (`apps/web/public/fonts/Riyal-*.woff2`), left of the number in every language, as the account page's tickets draw it.
- `shared/shared.js` — **generated** by `npm run sync` from the booking site's source (`~/micromobilityrentals`, or
  `RENTALS_DIR`): the Privacy Notice and its version, calling codes, phone rules and the site's own strings for the
  account step. Re-sync whenever the site changes the notice.
- `src/page.html` — **generated** by `npm run build` (with `apps/web/src/forms/lockers-page.ts`). Never edit it by
  hand. The build refuses a page whose Arabic misses a string or has one it no longer shows.

## Change it
```bash
cd forms/lockers
npm install
npm run sync      # only when the site's notice or lists changed
npm run build     # writes src/page.html and apps/web/src/forms/lockers-page.ts
```
Commit both files. CI refuses a push whose committed page is not what `npm run build` makes.

## Tests
```bash
npx playwright install chromium   # first time only
npm run e2e
```
`tests/lockers.spec.ts` drives the page in a browser with every database call stubbed and the clock fixed on a day in
2099; `tests/fonts.spec.ts` checks the fonts are the site's own; `SHOTS=<dir> npx playwright test shots` writes
screenshots for review (not part of CI).
