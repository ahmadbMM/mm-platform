# micromobility.sa/dukan

Dukan's employees' bike registration (the user, 2026-11-12): one page that the website (`apps/web`) serves at
`/dukan`, outside Coming Soon, as a page of the website (`app/[locale]/dukan`) and as its own page with `?classic=1`
(`app/dukan/route.ts`). It is `forms/petromin` cut down to what Dukan asks: built and tested the same way.

## What it asks
Three steps: the night, the rider's **full name and mobile number**, then Check and agree (the answers with a Change on
each part, the Privacy Notice and waiver boxes, "Agree and register"). One rider a registration: no companions, no
badge, company, height or bike type (the desk picks the bike). The ticket has its D- number, a QR the desk scans
(`MMP-D-001`), Find my booking, Cancel my booking, a calendar file and, on an iPhone, Apple Wallet. Edit opens on the
summary. "Register another" keeps the phone's earlier registrations (`mm-dukan-registration`, `mm-dukan-kept`; never
the Petromin form's keys). No price is shown: Dukan is billed for its riders.

The nights are the partner nights the Petromin form lists. The page names a night by its day and time only, never by its
title, and names no company but MicroMobility and Dukan (the build refuses `s.title`, and a dictionary word naming
another company).

## The database
The rentals RPCs, with the Petromin form's arguments; a Dukan registration is told apart by `p_company: 'Dukan'`:
- `rider_sessions({p_source: 'petromin'})`;
- `rider_register({p_badge: '', p_name, p_height: null, p_type: null, p_source: 'petromin', p_phone, p_session_id,
  p_company: 'Dukan', p_riders: [], p_waiver, p_privacy, p_lang})`: the server makes the badge from the phone, gives
  the default bike and the number D-001, D-002 ... each night; the same phone on the same night updates its booking;
- `rider_edit` with the same fields and `p_proof_phone`, `p_from_session`; `rider_lookup` and `rider_cancel` as on the
  Petromin form (Find my booking shows a Dukan registration only);
- `form_step({p_form: 'dukan', ...})`: step 1 the night, 2 the details, 3 Check and agree; fields `session`, `name`,
  `phone`, `privacy`, `waiver`.
Apple Wallet goes through the website's `/api/petromin-pass`, which the booking app answers with a pass in Dukan's
colours. The page loads no supabase-js: its calls are plain POSTs (`rpcFetch`), so its address allows no script from
elsewhere.

## Change it
```bash
cd forms/dukan
npm install
npm run build     # writes src/page.html, apps/web/src/forms/dukan-page.ts and the website's copy (forms/site/dukan.*)
```
Commit everything it writes; CI refuses a push whose committed page is not what `npm run build` makes. Every word is in
`T` in `design/app.js`, keyed by its English, in all fifteen other languages (the Petromin form's own wording wherever
it carries over); the website's copy fetches one language's file (`apps/web/public/forms/dukan/t/<lang>.<hash>.json`).
Never edit `src/page.html` by hand.

## The look
Dukan's (dukan.me's stylesheet): green `#1b7563` for every action and focus ring, `#004f3d` under a press, the
orange-red `#ec2f04` of its mark as an accent only, black on white, and its face Rubik (the website's own files,
`apps/web/public/fonts/forms`); Urdu keeps IBM Plex Sans Arabic, Hindi and Nepali Noto Sans Devanagari, Bengali Noto
Sans Bengali. MicroMobility's mark and Dukan's logo sit side by side over the form; the tab icon and the ticket carry
Dukan's mark drawn as an SVG.

## Tests
```bash
npm install
npx playwright install chromium webkit   # first time only
npm run e2e        # the form's own page (serve.mjs), PW_PORT for another port
npm run e2e:site   # the website's page, after `next build` in apps/web
```
Every Supabase call is stubbed, so nothing is ever written to the database. The specs cover the registration's
arguments and its D- number, that no other company or night title shows (in five scripts), Dukan's look, the step
counts, editing, the waiver and Privacy Notice, names and digits, Find my booking (a Dukan booking only), Cancel my
booking, the calendar file, Apple Wallet on an iPhone, every word in every language, an accessibility check of every
step (axe, English and Arabic), Jeddah's time on a phone set elsewhere, and a 320 px screen.
