# micromobility.sa/petromin-invite

The booking of the people Petromin invites to its bike nights, who are not its employees (the owner, 2026-11-12): one
page that the website (`apps/web`) serves at `/petromin-invite`, outside Coming Soon, as a page of the website
(`app/[locale]/petromin-invite`) and as its own page with `?classic=1` (`app/petromin-invite/route.ts`). It is
`forms/dukan`'s single-rider form with a bike step, in the Petromin form's look: built and tested the same way.

## What it asks
Four steps: the night, the guest's **full name and mobile number**, the **bike type** (Hybrid or Mountain, the two the
Petromin form offers), then Check and agree (the answers with a Change on each part, the Privacy Notice and waiver boxes,
"Agree and register"). One rider a booking: no companions, badge, company or height. A guest is a walk-in booking on the
night's Bookings list and pays the standard fare at the desk, so the ticket shows the price (a field, no line about
paying). The ticket has its I- number, a QR of the booking's own code (`ref`, `MMC-...`, which the desk's scanner reads
straight into check-in), the night and its hours, when bikes are handed out, where, the bike and the price, and, on a full
night, "On the waitlist" (a status word, never a place in the line). Find my booking (an I- number only), Cancel my
booking, a calendar file and, on an iPhone, Apple Wallet. Edit opens on the summary; the mobile number is the booking's
proof and its key, so an edit shows it locked (another number is another booking: cancel and book again). "Register
another" keeps the phone's earlier bookings (`mm-pminvite-booking`, `mm-pminvite-kept`).

The nights are the partner nights the Petromin form lists, named by their day and time only, never by their title. The
page names no company but MicroMobility and Petromin (the build refuses `s.title`, an `MMP-` code, a Road tile, and a
dictionary word naming another partner).

## The database
- `rider_sessions({p_source: 'petromin'})`, as the Petromin and Dukan forms ask it;
- `petromin_invite_book({p_session_id, p_name, p_phone, p_type, p_waiver, p_privacy})` makes the booking (I-001, I-002
  ... each night; the same phone on the same night updates it), and with `p_from_no` and `p_from_session` (the booking's
  number and night) changes it: the same night updates it, another night books there and cancels the old one;
- `petromin_invite_lookup({p_invite_no, p_phone, p_session_id?})` for Find my booking, Edit and a kept confirmation
  brought up to date; `petromin_invite_cancel({p_invite_no, p_phone, p_session_id})`;
- `form_step({p_form: 'pminvite', ...})`: step 1 the night, 2 the details, 3 the bike, 4 Check and agree; fields
  `session`, `name`, `phone`, `type`, `privacy`, `waiver`.
`p_waiver` is the ride waiver's version (`2026-10-v3`), `p_privacy` this page's own notice (`pminvite-2026-11-12`, sent
on an edit too: the notice the booking was made under). Apple Wallet goes through the website's `/api/petromin-pass`.
The page loads no supabase-js: its calls are plain POSTs (`rpcFetch`), so its address allows no script from elsewhere.

## Change it
```bash
cd forms/petromin-invite
npm install
npm run build     # writes src/page.html, apps/web/src/forms/petromin-invite-page.ts and the website's copy (forms/site/petromin-invite.*)
```
Commit everything it writes; CI refuses a push whose committed page is not what `npm run build` makes. Every word is in
`T` in `design/app.js`, keyed by its English, in all fifteen other languages (the Dukan, Petromin and Saturday forms' own
wording wherever it carries over); the website's copy fetches one language's file
(`apps/web/public/forms/petromin-invite/t/<lang>.<hash>.json`). Never edit `src/page.html` by hand.

## The look
The Petromin form's: its cream, green `#077a4b` and neon, Space Grotesk with IBM Plex Sans Arabic, Noto Sans Devanagari
and Noto Sans Bengali (the website's own files, `apps/web/public/fonts/forms`), MicroMobility's mark beside Petromin's
logo over the form, MicroMobility's mark as the tab icon. The riyal sign is the site's own font file
(`apps/web/public/fonts/Riyal-*.woff2`), drawn as the website's tickets draw it.

## Tests
```bash
npm install
npx playwright install chromium webkit   # first time only
npm run e2e        # the form's own page (serve.mjs), PW_PORT for another port
npm run e2e:site   # the website's page, after `next build` in apps/web
```
Every Supabase call is stubbed (`tests/flow.ts` answers any call a spec does not), so nothing is ever written to the
database.
