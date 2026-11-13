# micromobility.sa/petromin

The registration for the Petromin nights: one page that the website (`apps/web`) serves at `/petromin`, outside Coming
Soon, as a page of the website (`app/[locale]/petromin`) and as its own page with `?classic=1` (`app/petromin/route.ts`).
Since 2026-11-13 it is the one page for everyone who rides those nights (the owner: "merge the petromin page with dukan
page all under /petromin make the first step to select the company"). `micromobility.sa/dukan` and
`micromobility.sa/petromin-invite`, pages of their own for two days, are turned off: no page, no redirect.

## The first step: the company
"Which company are you an employee for?" with four tiles: Petromin, Petrolube, Dukan, and Guest/Other. What follows
depends on the pick (`KIND` in `design/app.js`; each step's boxes are a pane, `data-pane`, and the pick orders them):

| Pick | Steps after it | Sent to | Number |
| --- | --- | --- | --- |
| Petromin, Petrolube (`emp`) | the night, the rider (badge, name, mobile), height and bike with up to four companions, Check and agree | `rider_register` / `rider_edit` | PM-001 (Petromin) / PL-001 (Petrolube) a night |
| Dukan (`dukan`) | the night, the rider (name and mobile, no badge), height and bike (both required, Hybrid or Mountain, no companions), Check and agree | `rider_register` / `rider_edit` with `p_badge: ''`, `p_company: 'Dukan'`, `p_riders: []` | D-001 a night |
| Guest/Other (`guest`) | a MicroMobility account (signed into or made here) and the company they are from, the night, the bike, Check and agree | `petromin_guest_book` | I-001 a night |

Find my booking is on the first step: a P- or D- number asks `rider_lookup`, an I- number `petromin_invite_lookup`; a
number typed without its letter takes the picked company's (P when none is picked). The booking found shows in its own
company's look, whatever was picked.

### Dukan's employees
From the pick on the page wears Dukan's look (dukan.me: green `#1b7563`, the orange-red of its mark as an accent, Rubik,
MicroMobility's mark beside Dukan's logo, the D mark on the ticket), named on the page itself (`html[data-co="dukan"]`,
`styles.css`), and names no other company: the nights by their day and time, never their title (only `nightTitle()`
reads `s.title`, for Petromin's and Petrolube's employees; the build refuses another read), its own Privacy Notice
(`PV_DUKAN`, version `dukan-2026-11-13`), its own calendar file. Back on the first step the page is as before the pick.
The specs read every word showing after the pick, in five scripts.

### Invited guests
A guest must have a MicroMobility account (the owner: guests "create an account and go through the whole process"), made
or signed into on this page (`src/guest.js`). The account step is the booking site's own sign-in and sign-up, as the
Saturday ride's page asks them: `customer_login` (`forms/shared/account.js`), or `customer_exists` twice,
`customer_signup`, `customer_consents` (the website's Privacy Notice, at the version `apps/web/src/content/privacy-notice.ts`
names: the build reads it) and `customer_set_emergency`. Signed in, the step asks the company the guest is from (typed,
required; the booking writes it to the account) and whatever the account still owes that this page can ask
(`customer_fix_fields`: a height, the emergency contact, the nationality, the date of birth); anything else is finished
in the booking app, which the step links to. The lists (calling codes with their mobile rules, nationalities, the
contact's relations) are the booking site's own, read at build time from `forms/saturday/shared/shared.js`.
`petromin_guest_book({p_id, p_token, p_session_id, p_type, p_company, p_waiver, p_from_no?, p_from_session?})` books (the
name, mobile and height are the account's); an Edit is the same call with the booking's number and night. The session
lives in memory only, never in the phone's storage: after a reload Edit asks to sign in again. The ticket shows the I-
number, a QR of the booking's own code (`ref`, which the desk scans straight into check-in), the bike, the company and
the fare paid at the desk, and "On the waitlist" on a full night (a status word, never a place in the line). A booking
made on the old page has no account behind it (`account: false`): it can be found and cancelled here, not changed.

## Change it
```bash
cd forms/petromin
npm install
npm run build     # writes src/page.html, apps/web/src/forms/petromin-page.ts and the website's copy (forms/site/petromin.*)
```
Commit everything it writes. The website serves the page from its next deploy (a merge to main), and CI refuses a push
whose committed page is not what `npm run build` makes. Never edit `src/page.html` by hand. Then open
https://micromobility.sa/petromin. Arabic: https://micromobility.sa/petromin?lang=ar

The sources: `design/index.html`, `design/styles.css`, `design/app.js` (the steps, the phone box, every word in `T`),
`src/live-submit.js` (the calls, the ticket, Find, Edit, Cancel, the notices) and `src/guest.js` (an invited guest's
account and booking). The build puts the last two where the design's demo submit was, inlines the pictures (each one
once), the QR generator (`vendor/`) and the shared account step, and loads no script from elsewhere: the calls are plain
POSTs to the database (`rpcFetch`), so the page's address allows no outside script.

Every word is in `T` in `design/app.js`, keyed by its English, in all fifteen other languages; the build refuses a word
the page shows that a language lacks. The website's copy carries one language: the build writes each one's words to
`apps/web/public/forms/petromin/t/<lang>.<hash>.json` and fetches the page's before the form starts.

The session list must never grey out or label a session by capacity: the capacity on a session limits website bookings
only, partner registrations have no cap (the build refuses a script that reads `spots`). A guest's full night is the
server's to say, on the ticket.

## One phone, several people
Edit changes the booking on the screen. "Register another" opens a fresh form at the first step (and forgets a guest's
account); the confirmation on the phone stays until the new registration goes through, then is listed under the new one
(`mm-petromin-registration` and `mm-petromin-kept` in the phone's storage, each record with its kind, kept until 6 hours
after its session). What the old pages left on a phone (`mm-dukan-*`, `mm-pminvite-*`) joins these once, at the first
visit, so a ticket made there still shows.

## Step counts
`form_step` counts each step seen, each box refused at Continue and each registration, without anyone in it (read on the
staff Petromin page as Form steps). The company step is form `pmhome` step 1 (the pick as its `done`); each kind's own
steps are numbered from 1 under its form: `petromin` (1 the night, 2 the details, 3 the bike, 4 Check and agree, as
before the company step), `pmdukan` (the same four) and `pmguest` (1 the account, 2 the night, 3 the bike, 4 Check and
agree). A test browser counts nothing.

## Tests
```bash
npm install
npx playwright install chromium webkit   # first time only
npm run e2e        # the form's own page (serve.mjs), PW_PORT for another port
npm run e2e:site   # the website's page, after `next build` in apps/web
```
The specs drive the real page in a browser with every Supabase call stubbed, so nothing is ever written to the database.
They run on an Android phone (Chromium), and the ones tagged `@webkit` on an iPhone as well. `tests/flow.ts` walks the
steps for them (and answers a guest's account calls). They cover the company step and its wording, each kind's
registration and its arguments, Dukan's look and the words showing after its pick, a guest's sign-in, sign-up, owed
answers, refusals and Edit, the old pages' saved tickets, the step counts, the ride waiver and the Privacy Notices,
names and digits, Find my booking, Cancel my booking, the calendar file, an accessibility check of every step (axe,
English and Arabic), Jeddah's time on a phone set elsewhere, and a 320 px screen.

On the website's page the form's script starts once the page is on screen and its language has come; until then the
card takes no tap (`.card:not([data-live])`), so one made too early is never lost without a sign.

## The database
The rentals repo: `20261111030000_petromin_form_round.sql` (the form's calls), `20261112210000_dukan_registrations.sql`
(company Dukan, D- numbers), `20261112234500_petromin_invitees.sql` (I- numbers, the guests' lookup and cancel) and
`20261113150000_petromin_merged_page.sql` (`petromin_guest_book`, the step counts' new forms).
