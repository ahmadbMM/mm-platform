# micromobility.sa/farmhouse

The Farmhouse Night's booking page (the user, 2026-11-15: "create a webpage for booking the farmhouse session themed
with the same theme of the session, make sure to ask if they have an account or not and make them go through the whole
process, make it through a new url and only allow reservations through a code"). Anyone with the code books: no
Community tag needed, and someone with no account makes one on the page. Every booking still waits for staff's
approval, as on the night itself. The night may be closed in the booking app: this page keeps booking it until its
places are taken (the database's `farm_book`), and stops when it is marked Full, no waitlist, called off, or over.

One self-contained page that the website (`apps/web`) serves at that address, outside Coming Soon, built the way
`forms/saturday` is. In the website's sixteen languages (`?lang=`; Arabic and Urdu right to left), light and dark as the
device is set, in the night's own "Harvest Supper" look (the booking app's `--fh-*` tokens: rust, peach and cream, the
title in Rubik, the venue's round picture `/site/farm-logo.jpg`, its fan of feathers). The website draws it as one of
its own pages (`apps/web/src/app/[locale]/farmhouse`); `?classic=1` answers with the page built on its own.

## What it does, in order

1. **The code** (`farm_night(p_code, p_id, p_token)`): the page names the night and nothing more until the code is
   good. A good code shows the night it opens: its date, arrival and dinner, the venue and its map, the venue's
   Instagram, who comes (you and up to three family members) and its state: open, fully booked or bookings closed. Never
   a count of places or people. A wrong code is metered by address (`throttled` after 30 in ten minutes).
2. **The account**: "Do you have a MicroMobility account?" Yes: the booking site's own sign-in; no: its sign-up
   (no height: the night has no bike). A forgotten password goes through the booking app (`?handoff=farmhouse&lang=`),
   which sends the rider back to `/farmhouse?code=<one-time code>`; the booking code waits for the way back in this
   tab's sessionStorage (`mm-farmhouse-code`) and is checked again on arrival.
3. **Your details**: only what the account still owes before it books (`customer_fix_fields`, the database's
   `_customer_asks`: an emergency contact, the nationality, a field staff flagged). Skipped when there is none; anything
   the page cannot ask is finished on the booking site.
4. **Who is coming**: the night read again with the account (`held`: the names it already holds there). With none, the
   account holder comes first (their name as the account has it) and up to three family members; with some, family
   members only, four in all per account; with four, nothing more to add and the booking is one press away. Each name
   as a booking takes it (letters and spaces, every part two letters or more). The review and the Farm House Night's own
   waiver (`shared.js FARM_WAIVER`, version `farm-2026-11-v1`). `farm_book(p_id, p_token, p_session, p_code, p_family,
   p_waiver)` sends the family's names only: the database adds the holder when the account holds no place there. Its
   refusals are rows, each with its words: `throttled`, `signin`, `code`, `session`, `waiver`, `input`, `name`, `fix`,
   `nothing`, `cap`, `full`, `room`.
5. **Sent**: "Your request is in" with the names, then the booking app, signed in by a one-time code:
   `customer_handoff_create`, then `<booking app>?signin=<code>&tab=bookings&lang=`.

Database: `20261115210000_farmhouse_page.sql` in the booking site repo (`farm_codes`, `queue_entries.farm_code`,
`farm_night`, `farm_book`, and the in-place patches to `customer_create_booking` and `_community_booking_gate`). The code
itself is a row of `farm_codes`, written on each database by hand: never in either repository, which are public.

## Where things come from
- `design/` — the page: `index.html`, `styles.css`, `app.js`, `i18n.js` (its own strings in the fifteen other
  languages, keyed by the English), `mm-lockup.svg`, `favicon.png`. The fonts are the website's files
  (`apps/web/public/fonts/forms`); the venue's picture is the website's `public/site/farm-logo.jpg`.
- `shared/shared.js` — **generated** by `npm run sync` from the booking site's source (`~/micromobilityrentals`, or
  `RENTALS_DIR`): the Privacy Notice, the Farm House Night's waiver and its version (the booking app's ten languages,
  the website's six more from `apps/web/src/i18n/tx`), nationalities, calling codes, phone rules and the site's own
  strings for the account step. Re-sync whenever the site changes the notice or the farm waiver; the website's unit test
  checks the waiver is the one `content/farm-words.ts` has, in every language.
- `src/page.html` — **generated** by `npm run build` (with `apps/web/src/forms/farmhouse-page.ts` and the website's
  `apps/web/src/forms/site/farmhouse.*`). Never edit them by hand. The build refuses a page whose languages miss a
  string or keep one it no longer shows.

## Change it
```bash
cd forms/farmhouse
npm install
npm run sync      # only when the site's notice, the farm waiver or the lists changed
npm run build
```
Commit the generated files. CI refuses a push whose committed page is not what `npm run build` makes.

## Tests
```bash
npx playwright install chromium   # first time only
npm run e2e                        # the page on its own (serve.mjs, port 8794 or PW_PORT)
npm run e2e:site                   # the same specs on the website's page, after `next build` in apps/web
```
`tests/farmhouse.spec.ts` drives the page with every database call stubbed; `tests/fonts.spec.ts` checks the fonts are
the site's own; `SHOTS=<dir> npx playwright test shots` draws screenshots for review.
