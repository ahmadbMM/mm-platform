# micromobility.sa/community/registration

The community membership application: one self-contained page that the website (`apps/web`)
serves at that address, outside Coming Soon. Same look as the Petromin form (`forms/petromin`).
It moved here from its own repo and Cloudflare Worker (`~/code/community-worker`,
`mm-community-register`) on 2026-09-25; it is due to be rebuilt as a real website page later.

Riders fill in name, date of birth, gender, nationality, height, mobile, email, Instagram,
LinkedIn, profession, workplace (where they work or study, since 2026-09-29), bike type (Road, Hybrid or Mountain) and how they heard of us (the booking
site's answers and their labels, synced; since 2026-09-28 this form and the learn-to-ride form ask it,
the booking app's sign-up no longer does), confirm the Privacy Notice (required) and
may ask for ride news (optional). Every field is checked the way the booking site's staff
"Looks off" check reads accounts (misspelt email providers, throwaway domains, phone numbers
against Google's libphonenumber mobile rules, initials-only names, and so on), then sent to
`community_apply`. Staff review them in the booking site: **Community > Applications**.

## Where things come from
- `design/` — the page: `index.html`, `styles.css`, `app.js`, `i18n.js` (the form's own
  strings in 9 languages, keyed by the English text), logos.
- `shared/shared.js` — **generated** by `npm run sync` from the booking site's source
  (`~/micromobilityrentals`, or `RENTALS_DIR`): the Privacy Notice and its version, the language
  list, nationalities, calling codes, phone rules and the site's own strings for the consent
  boxes, date picker and gender. Re-sync whenever the site changes the notice.
- `src/page.html` — **generated** by `npm run build`. Never edit it by hand.
- Database: `supabase/migrations/20260922200000_community_applications.sql` in the booking
  site repo (table `community_applications`, `community_apply`, the staff approve/reject RPCs,
  and the forced password change).

## Change it
```bash
cd forms/community
npm install
npm run sync      # only when the site's notice or lists changed
npm run build     # writes src/page.html and apps/web/src/forms/community-page.ts
```
Commit both files. The website serves the page from its next deploy (a merge to main), and CI
refuses a push whose committed page is not what `npm run build` makes. There is no deploy of
its own any more. Then open https://micromobility.sa/community/registration (Arabic: `?lang=ar`).

## Tests
```bash
npx playwright install chromium   # first time only
npm run e2e
```
The specs drive the real page against `serve.mjs` (the built page at its address) with
`community_apply` stubbed, so nothing is written to production. CI runs them before every deploy.
The website's own test (`apps/web/src/lib/__tests__/forms.test.ts`) checks the route and headers.
