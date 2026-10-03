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

## Add another partner path
The page reports the first path segment as the registration's `source`.
1. Add `apps/web/src/app/<slug>/route.ts` re-exporting `GET` and `HEAD` from `app/petromin/route.ts`.
2. Add the slug to `FORM_ADDRESSES` and the matcher in `apps/web/src/proxy.ts`, so Coming Soon leaves it alone.
3. Merge to main.
Registrations from that path show `/slug` under the badge in the staff Riders tab and in the CSV.

## Tests

```bash
npm install
npx playwright install chromium   # first time only
npm run e2e
```

The specs drive the real page in a browser against `serve.mjs` (the built page at its address),
with every Supabase call stubbed, so nothing is ever written to production. CI runs them (`npm run
e2e`) before every deploy. They cover registering with companions,
editing a booking afterwards, the ride waiver (required on every registration and edit, sent as `p_waiver`), the booking card, and that every string on the card and in the
companions block has a translation in all seven non-English languages.

## Update the design
1. Export from Claude Design and copy the files into `design/` (index.html, styles.css, app.js, logo.png, petromin-logo.avif), overwriting the old ones.
2. `npm run build` builds `src/page.html` and the website's copy (inlines CSS and logos, swaps the demo submit for `src/live-submit.js`).
3. Commit and merge to main.
The session list must never grey out or label a session by capacity: the capacity on a session limits website bookings only, partner registrations have no cap (the merge refuses an export that reads `spots`). The merge needs the export to keep the element ids and the two markers in app.js (`/* Submit: demo behaviour.` and `window.RiderRegistration`); it stops with a clear message if the design dropped one. Never edit `src/page.html` by hand, it is generated.
