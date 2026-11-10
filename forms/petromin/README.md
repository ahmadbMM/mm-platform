# micromobility.sa/petromin

The rider registration form for partner company rides: one self-contained page that the website
(`apps/web`) serves at `/petromin`, outside Coming Soon. It moved here from its own repo and
Cloudflare Worker (`~/code/petromin-worker`, `mm-partner-register`) on 2026-09-25; it is due to be
rebuilt as a real website page later.

## Change it
```bash
cd forms/petromin
npm install
npm run build     # writes src/page.html and apps/web/src/forms/petromin-page.ts
```
Commit both files. The website serves the page from its next deploy (a merge to main), and CI
refuses a push whose committed page is not what `npm run build` makes. There is no deploy of its
own any more. Then open https://micromobility.sa/petromin. Arabic: https://micromobility.sa/petromin?lang=ar

## Another partner path
The page reports the first path segment as the registration's `source`, but the database takes
`petromin` only: `rider_register` answers any other source with `session` ("This session is no
longer open") so the employees' fare cannot reach another ride. A second partner therefore needs a
database change first (rentals repo: `rider_register`, `rider_sessions` and that partner's ride
kind), and only then the website side:
1. Add `apps/web/src/app/<slug>/route.ts` re-exporting `GET` and `HEAD` from `app/petromin/route.ts`.
2. Add the slug to `FORM_ADDRESSES` and the matcher in `apps/web/src/proxy.ts`, so Coming Soon leaves it alone.
3. Merge to main.

## Tests

```bash
npm install
npx playwright install chromium webkit   # first time only
npm run e2e
```

The specs drive the real page in a browser against `serve.mjs` (the built page at its address),
with every Supabase call stubbed, so nothing is ever written to production. They run on an Android
phone (Chromium), and the ones tagged `@webkit` on an iPhone as well (`playwright.config.ts`). CI runs
them (`npm run e2e`) before every deploy, and again on the website's page for the form (`npm run
e2e:site`, after `next build`). `tests/flow.ts` walks the four steps for them. They cover registering
with companions, editing a booking from its summary, the ride waiver (required on every registration
and edit, sent as `p_waiver` with the page's language as `p_lang`), the Privacy Notice, names and
digits, Find my booking, Cancel my booking, the calendar file, every string in every language, an
accessibility check of every step (axe, English and Arabic), Jeddah's time on a phone set elsewhere,
and a 320 px screen.

## The form (2026-11-11)
Four steps: the night, the rider, the bikes (companions as cards, each written in a centred dialog),
then Check and agree (the answers with a Change on each part, the Privacy Notice and waiver boxes,
"Agree and register"). Edit opens on that summary. The ticket has Find my booking (`rider_lookup`:
the number and the mobile it was made with), Cancel my booking (`rider_cancel`), a calendar file and,
on an iPhone, Apple Wallet (the website's `app/api/petromin-pass`, which asks the booking app's
`/api/wallet-pass`). Each step seen, each box refused at Continue and each registration is counted
without anyone in it (`form_step`, read on the staff Petromin page as Form steps). Riders see no hint
lines (the owner's rule): what they need is in the labels, the messages, and as facts on the night's
card and the ticket (bikes from, where, the helmet). The database side is rentals'
`20261111030000_petromin_form_round.sql`.

Every word is in `T` in `design/app.js`, keyed by its English, in all fifteen other languages. The
website's copy carries one language: the build writes each one's words to
`apps/web/public/forms/petromin/t/<lang>.<hash>.json` and fetches the page's before the form starts.

## One phone, several people
Edit changes the booking on the screen. "Register another" opens a fresh form; the confirmation on
the phone stays until the new registration goes through, then is listed under the new one
(`mm-petromin-kept` in the phone's storage, each kept until 6 hours after its session).

## Update the design
1. Export from Claude Design and copy the files into `design/` (index.html, styles.css, app.js, logo.png, petromin-logo.avif), overwriting the old ones.
2. `npm run build` builds `src/page.html` and the website's copy (inlines CSS and logos without their metadata chunks, swaps the demo submit for `src/live-submit.js`). The fonts are the website's files (`apps/web/public/fonts/forms`), never Google Fonts.
3. Commit and merge to main.
The session list must never grey out or label a session by capacity: the capacity on a session limits website bookings only, partner registrations have no cap (the merge refuses an export that reads `spots`). The merge needs the export to keep the element ids and the two markers in app.js (`/* Submit: demo behaviour.` and `window.RiderRegistration`); it stops with a clear message if the design dropped one. Never edit `src/page.html` by hand, it is generated.
