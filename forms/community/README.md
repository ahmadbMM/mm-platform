# micromobility.sa/community/registration

The community membership application: one self-contained page that the website (`apps/web`)
serves at that address, outside Coming Soon. Same look as the Petromin form (`forms/petromin`).
It moved here from its own repo and Cloudflare Worker (`~/code/community-worker`,
`mm-community-register`) on 2026-09-25; it is due to be rebuilt as a real website page later.

Two steps (the owner, 2026-09-30: the applicant makes their account first):

1. **Your account** is the booking site's own sign-up: first and last name, gender, email, mobile,
   password (8 characters, an upper-case letter and a digit, typed twice), height, the Privacy
   Notice (required) and ride news (optional). It calls `customer_exists` (email, then mobile, so the
   message says which is taken), `customer_signup` and `customer_consents`, and then says clearly
   that the account has been created. It also asks the **emergency contact** (the owner, 2026-10-07:
   required, a second one optional behind "Add a second contact"), checked before the account is made
   and saved the moment it exists (`customer_set_emergency`, then `customer_set_emergency2` when the
   second is filled). Should that save be refused, the account stays made and step 2 asks again.
2. **Membership** asks what the sign-up does not: date of birth, nationality, Instagram and LinkedIn
   (may be left empty, silently), profession, company, bike type (Road, Hybrid or Mountain) and how
   they heard of us. It is sent from that account with `customer_community_apply(id, token, answers)`,
   so the application carries the account (`community_applications.customer_id`). An account handed
   over without an emergency contact (`customer_emergency`) gives it here, saved before the application
   goes; a database without those functions asks nothing, one that answers three columns offers no second.

**Kept on this device** (the owner, 2026-10-25: "save progress"): what the applicant typed or picked is kept in
localStorage `mm-community-draft` for three days (`MMAccount.draft`, forms/shared/account.js): never a password, a
session or a tick of the notice. Opening the page again puts the account step's answers back and returns to that step;
an account made here (or a signed-in one) signs in again, its email filled in, and finds its membership answers there.
Sending, being a member already, or **Start over** removes it.

**Where the application is** (the owner, 2026-10-25: "track your application"): the thank-you card links to
`/community/registration?track=<token>` (`community_applications.track_token`, `community_track`, migration
20261025210000 in the rentals repo), which shows the application instead of the form: received, the changes staff
asked for with a button to make them (the booking site's `?appfix=` page), the changes sent, and the decision (with our
team / approved / invited to a ride, its day and time / not approved this time). The link is kept on the device
(`mm-community-track`), so the first question names an application sent before, and a signed-in account with one
waiting gets its link too (`customer_community_me` gives `track`).

**The sign-in, the hand-over and which questions are asked** are the account step every account form shares:
forms/shared/account.js (see its README). A temporary password goes to the booking site first (`customer_pwd_state`),
in the booking site's own words (synced: authIdentifier, errEmailOrPhone, errPasswordRequired, errInvalidCredentials,
errLoginLocked, errLoginPhoneCc).

**First question** (the owner, 2026-10-25): "Do you already have a Micromobility account?". No goes on to step 1.
Yes signs in right here (email or mobile and password, `customer_login`; a Saudi 05X number is sent as +9665X), or on the
booking site for a forgotten password or a Google/Apple account. A signed-in account is asked on step 2 only what it does
not hold yet, or what staff flagged on it (`customer_community_me`'s `flags` = `customers.fix_fields`, migration
20261025180000 in the rentals repo): a filled, unflagged question is hidden but still sent from its prefilled box, named in
one line with **Show them**, and comes back by itself if its saved value fails the checks; a flagged one says "Our team asked
you to check this." A flagged height or emergency contact is asked too; `customer_community_apply` clears the flags it
answered (`emergency_saved` when the contact was saved on this step). A `?code=` hand-over skips the question.

Someone who already has an account presses **Sign in**: the booking site (`?handoff=community`) signs
them in and sends them back with a one-time code (`?code=`, `customer_handoff_create` /
`customer_handoff_redeem`), straight onto step 2 with their answers so far (`customer_community_me`).
The booking site's members-only popup ("Apply for MicroMobility's Community Membership") does the
same. The application carries `privacy_version` and `privacy_ack: true` only when this form showed the
Privacy Notice box and it was ticked: the account step's, or step 2's, which appears when the database
answers `privacy` for a signed-in account it holds no confirmed notice for. The session lives in the page only, never in storage. Every field is checked the way the booking
site's staff "Looks off" check reads accounts (misspelt email providers, throwaway domains, phone
numbers against Google's libphonenumber mobile rules, initials-only names, and so on). Staff review
the applications in the booking site: **Community > Applications**.

## Where things come from
- `design/` — the page: `index.html`, `styles.css`, `app.js`, `i18n.js` (the form's own
  strings in 9 languages, keyed by the English text), logos. The build drops any metadata chunk from
  the PNGs it inlines. The fonts are the website's files (`apps/web/public/fonts/forms`, named in
  `styles.css`), never Google Fonts.
- `shared/shared.js` — **generated** by `npm run sync` from the booking site's source
  (`~/micromobilityrentals`, or `RENTALS_DIR`): the Privacy Notice and its version, the language
  list, nationalities, calling codes, phone rules and the site's own strings for the consent
  boxes, date picker, gender, the sign-up's labels and password messages, and the emergency contact's
  labels, relations (`EM_RELS`) and messages. Re-sync whenever the site changes the notice.
- `src/page.html` — **generated** by `npm run build`. Never edit it by hand.
- Database: `supabase/migrations/20260922200000_community_applications.sql` in the booking
  site repo (table `community_applications`, the staff approve/reject RPCs), and
  `20260930160000_community_account_first.sql` (`customer_community_apply`, `customer_community_me`).

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
The specs drive the real page against `serve.mjs` (the built page at its address) with every
database call stubbed, so nothing is written to production. CI runs them before every deploy.
The website's own test (`apps/web/src/lib/__tests__/forms.test.ts`) checks the route and headers.
