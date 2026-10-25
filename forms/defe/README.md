# micromobility.sa/defe

Defe x MicroMobility: the page that books a place on the Saturday Social Ride with Defe (the owner,
2026-10-17). One self-contained page that the website (`apps/web`) serves at that address, outside
Coming Soon, built the way `forms/community` is. English and Arabic (`?lang=ar`, right to left),
light and dark as the device is set.

## What it does, in order

1. **The ride** (`partner_status('defe')`): the date, the bike pickup (`sessions.bike_slots`' `_time`),
   the meeting point (`meet_url`), the two routes, free with a helmet. Places are only ever **open**
   or **full** ("Places open" / "Full"; "Booking is closed" when no Defe ride is open): never a count
   of places or bookings (the owner, 2026-10-17). While a code is needed it says so, and when the
   code's places are used up it says more places open to everyone soon. No waitlist anywhere.
2. **The account**: *Create account* is the booking site's own sign-up, as `forms/community` step 1
   asks it (name, gender, email, mobile, password twice, height, the emergency contact with an
   optional second, the Privacy Notice, ride news): `customer_exists` (email, then mobile),
   `customer_signup`, `customer_consents`, `customer_set_emergency` (and `..._emergency2`). *Sign in*
   is the sign-in every account form shares (forms/shared/account.js, inlined by the build): `customer_login`
   (an email in lower case, a number in E.164, +966 when typed without a code),
   then `customer_pwd_state` (a temporary password is changed on the booking site first). Google,
   Apple and a forgotten password go through the booking app (`?handoff=defe&lang=`), which sends the
   rider back to `/defe?code=<one-time code>` (`customer_handoff_redeem`; the code leaves the address
   at once). The session lives in the page only, never in storage.
3. **Your details**: date of birth, nationality and Instagram every time, new account or old, filled in
   with what the account holds (the owner, 2026-10-23); the rest of what every Saturday ride asks for, only what the account lacks (read with
   `customer_profile`, `customer_emergency`, `customer_whatsapp`, `customer_fix_fields`), the height
   always: date of birth, nationality, whether the mobile is their WhatsApp too, Instagram, the
   emergency contact. Saved with `customer_set_emergency(2)`, `customer_set_birth_nat` (both values;
   the one not asked goes back as held), `customer_set_whatsapp`, `customer_set_socials` (merged with
   the handles the account has: the function replaces the whole object), `customer_set_height`. When
   `customer_fix_fields` still owes something this page cannot ask (an email, a password, a field staff
   flagged), the rider is sent to the booking site to finish it.
4. **Book**: the Defe code (only while it is needed), the group (Beginners 20 km / Intermediates 40 km),
   the bike (Road, Hybrid, Mountain, their own), whether they received a Defe shirt on 22 October and, if
   not, their T-shirt size XS-XXL (the owner, 2026-10-18: shirts go to riders who have none; sent as
   `entry.ask` {shirt_got, shirt}, kept on `queue_entries.partner_ask`, `SHIRT_SIZE` when no size), the review (free), and the ride waiver in a centred
   pop-up with its required tick. `partner_book(id, token, 'defe', code, entry)`; the entry carries
   the frame size from the height (the booking app's chart, by bike type) and the waiver's version.
   Its refusals each have their words: `PARTNER_FULL`, `PARTNER_CLOSED`, `BAD_CODE`, `CODE_USED_UP`,
   `ONE_PER_SESSION` (with "Open my booking"), `FIX_FIRST`, `WAIVER_REQUIRED`/`WAIVER_OUTDATED`,
   `PICK_TYPE`, `STALE_SESSION`, `RATE_LIMITED`.
5. **Booked**: a short summary, then about two seconds later (or on "Open my booking") the booking
   app, signed in by a one-time code: `customer_handoff_create`, then
   `<booking app>?signin=<code>&tab=bookings&lang=`. Without a code, its My Bookings.

Database: `20261017120000_partner_places.sql` in the booking site repo (`session_partners`,
`queue_entries.partner`, `partner_status`, `partner_book`).
Since `20261023120000_partner_codes.sql` the ride takes several codes, each with its own places
(`session_partner_codes`, set by staff on Bookings); `CODE_USED_UP` is that one code's field error, the
other codes still book; the page closes ("Code places are all booked") only when every code is used up.

## Where things come from
- `design/` — the page: `index.html`, `styles.css`, `app.js`, `i18n.js` (its own strings in Arabic,
  keyed by the English), `mm-lockup.svg` and `defe-logo.svg` (drawn inline, so the MicroMobility words
  follow the text colour), `favicon.png`. The fonts are the website's files
  (`apps/web/public/fonts/forms`): Archivo (display, its width and weight axes), Space Grotesk and IBM
  Plex Sans Arabic, each under its SIL Open Font License there.
- `shared/shared.js` — **generated** by `npm run sync` from the booking site's source
  (`~/micromobilityrentals`, or `RENTALS_DIR`): the Privacy Notice and its version, the ride waiver and
  its version (`WAIVER_VERSION`), nationalities, calling codes (Saudi Arabia first and again in its
  place, never Israel), phone rules, and the site's own English and Arabic strings for the sign-up,
  sign-in, consent boxes, date picker, gender and emergency contact. Re-sync whenever the site changes
  the notice or the waiver; the website's unit test checks the waiver is the one `content/waivers.ts` has.
- `src/page.html` — **generated** by `npm run build` (with `apps/web/src/forms/defe-page.ts`). Never
  edit it by hand. The build refuses a page whose Arabic misses a string or has one it no longer shows.

## Change it
```bash
cd forms/defe
npm install
npm run sync      # only when the site's notice, waiver or lists changed
npm run build     # writes src/page.html and apps/web/src/forms/defe-page.ts
```
Commit both files. CI refuses a push whose committed page is not what `npm run build` makes.

## Tests
```bash
npx playwright install chromium   # first time only
npm run e2e
SHOTS=/some/dir npx playwright test shots   # screenshots for a look (skipped otherwise)
```
The specs drive the real page against `serve.mjs` with every database call stubbed (and the booking
app it hands riders on to), so nothing is written to production. CI runs them before every deploy.
