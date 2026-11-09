# micromobility.sa/saturday

The Saturday Social Ride's booking page (the owner, 2026-11-08: "people can only register for saturday social rides
through a new link called micromobility.sa/saturday"). Riders book with a ride code staff give out: a valid code is
needed and is enough, member or not, and the booking then waits for staff's selection and Publish, as every Saturday
booking does. One self-contained page that the website (`apps/web`) serves at that address, outside Coming Soon,
built the way the Defe page (`forms/defe`, turned off 2026-11-09, in the git history) was.
In the website's sixteen languages (`?lang=`; Arabic and Urdu right to left), light and dark as the device is set. The
website draws it as one of its own pages (`apps/web/src/app/[locale]/<address>`: the site's header, footer and language
menu around it, its scripts run by the page; `forms/shared/site-form.mjs`); `?classic=1` answers with the page built on
its own, whose header has a menu of the sixteen languages (the user, 2026-11-09).

## What it does, in order

1. **The ride and the code** (`saturday_rides`): the next Saturday ride (open, full, or opening at a set time; never a
   count of places or bookings), then the ride code, checked before anything else (`saturday_rides(p_code)`: good on
   which rides, and whether it still has a place there). Its answers each have their words: a code that does not work,
   a code whose places are taken, a ride that opens later, `RATE_LIMITED` (30 wrong codes from one address in ten
   minutes, then a wait).
2. **The account**: the booking site's own sign-up and sign-in, exactly as the Defe page asked them.
   Google, Apple and a forgotten password go through the booking app (`?handoff=saturday&lang=`), which sends the
   rider back to `/saturday?code=<one-time code>`; the ride code waits for the way back in this tab's sessionStorage
   (`mm-saturday-code`) and is checked again on arrival.
3. **Your details**: date of birth, nationality and Instagram every time (`saturday_book` refuses an account without
   them: `FIX_FIRST`), the rest only what the account lacks, the height always; as the Defe page did.
4. **Book**: which Saturday (only when the code books more than one), the group, the bike, the review and the ride
   waiver. `saturday_book(p_id, p_token, p_session, p_code, p_entry)`. A code refused there (`refused`:
   `BAD_CODE`, `CODE_USED_UP`) is answered as a row, not an error, and sends the rider back to the code box; every
   other refusal is an error with its words (`SESSION_CLOSED`, `ONE_PER_SESSION`, `FIX_FIRST`, `WAIVER_*`,
   `PICK_TYPE`, `TYPE_CLOSED`, `MEMBER_BIKES_FULL`, `STALE_SESSION`, `RATE_LIMITED`).
5. **Sent**: "Your request is in" (or "You're on the waitlist" when the ride was full), then the booking app, signed
   in by a one-time code: `customer_handoff_create`, then `<booking app>?signin=<code>&tab=bookings&lang=`.

Database: `20261108120000_saturday_codes.sql` in the booking site repo (`saturday_codes`, `saturday_code_rides`,
`saturday_settings`, `queue_entries.ride_code`, `saturday_rides`, `saturday_book`, `saturday_link_only`). Staff make the
codes on a Saturday ride's Bookings page (Ride codes · Edit codes) and switch "Only at micromobility.sa/saturday" on
there; while it is on, the booking app sends Saturday dates here and the database refuses a rider's own booking made
anywhere else. The website's Experiences sends Saturday dates here too while it is on.

## Where things come from
- `design/` — the page: `index.html`, `styles.css` (MicroMobility's green, the community form's palette), `app.js`,
  `i18n.js` (its own strings in Arabic, keyed by the English), `mm-lockup.svg` (drawn inline, so its words follow the
  text colour), `favicon.png`. The fonts are the website's files (`apps/web/public/fonts/forms`).
- `shared/shared.js` — **generated** by `npm run sync` from the booking site's source (`~/micromobilityrentals`, or
  `RENTALS_DIR`): the Privacy Notice, the ride waiver and their versions, nationalities, calling codes, phone rules
  and the site's own strings for the account step. Re-sync whenever the site changes the notice or the waiver; the
  website's unit test checks the waiver is the one `content/waivers.ts` has.
- `src/page.html` — **generated** by `npm run build` (with `apps/web/src/forms/saturday-page.ts`). Never edit it by
  hand. The build refuses a page whose Arabic misses a string or has one it no longer shows.

## Change it
```bash
cd forms/saturday
npm install
npm run sync      # only when the site's notice, waiver or lists changed
npm run build     # writes src/page.html and apps/web/src/forms/saturday-page.ts
```
Commit both files. CI refuses a push whose committed page is not what `npm run build` makes.

## Tests
```bash
npx playwright install chromium   # first time only
npm run e2e
```
`tests/saturday.spec.ts` drives the page in a browser with every database call stubbed; `tests/fonts.spec.ts` checks
the fonts are the site's own.
