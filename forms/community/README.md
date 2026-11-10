# micromobility.sa/community/registration

The community membership application. The website (`apps/web`) shows it as one of its own pages (its header,
footer and sixteen languages around the form; forms/shared/site-form.mjs), and serves this folder's self-contained
page at `?classic=1` as the fallback. It moved here from its own repo and Cloudflare Worker
(`~/code/community-worker`, `mm-community-register`) on 2026-09-25.

**The rework of 2026-11-11** (the user, 2026-11-10: "do them all", the 25 items of the research report
"Community form enhancement" in the booking app's repo): the booking app's rider look ("Liquid": Rubik, 14 px controls,
26 px cards, pill buttons, warm shadows), short screens with Back and a progress bar, every problem of a screen at
once (on the questions and in a summary at the top that takes focus), each box checked as it is left, no hint or
introduction lines, a red star on required questions and nothing that says "optional", the code-only phone pickers
(no flag emoji), typed birth dates, a type-to-search nationality, one bike question, the sport question, a parent or
guardian for an applicant under 18, Check your answers, a new thank-you card, anonymous counts of where people leave,
and the website's page carrying English only with each other language as a file of its own (`apps/web/public/forms/community/lang`).

Two server steps (the owner, 2026-09-30: the applicant makes their account first), each in short screens:

0. **The first question** (gate): the page's one title, what membership gives and how joining works (beside the
   form on a wide screen, with a Corniche ride photo), and "Do you already have a MicroMobility account?".
1. **The account** is the booking site's own sign-up, in four screens: About you (first and last name, gender,
   height); How we reach you (mobile, whether it is their WhatsApp, email: leaving it calls `customer_exists`, email
   then mobile, so a taken one is said there with "Sign in instead"); Emergency contact (the owner, 2026-10-07:
   required, a second one behind "Add a second contact"); Create a password (8 or more characters and not a common one,
   typed once with show/hide: the database's `_pwd_common`, migration 20261111130000; the Privacy Notice, required; ride
   news on WhatsApp, optional). Create account calls `customer_exists` again, `customer_signup`, `customer_consents`,
   then saves the emergency contact (`customer_set_emergency`, `customer_set_emergency2`); should that save be
   refused, the account stays made and step 2 asks again. No way back from step 2: it would make a second account.
2. **Membership**, in screens: Birth date and nationality (three typed boxes; type to search, by the name in the
   reader's language, its English and Arabic names, its code and the usual other names; Saudi Arabia first and again
   in its place, no Israel; under 18, a parent or guardian: name, relation, mobile and their own tick of the notice,
   sent after the application with `customer_community_guardian`); Your riding ("Which bike will you ride?": Road,
   Hybrid, Mountain or My own bike, sent as bike_type and own_bike; "Do you compete in a sport?", the website's words
   and lists, saved on the account with `customer_set_sport` before the application); Work and socials (profession,
   company, Instagram required since 2026-11-11, LinkedIn behind "Add LinkedIn", how they heard of us); Check your
   answers (every answer, each with Change). Sent with `customer_community_apply(id, token, answers)`, so the
   application carries the account (`community_applications.customer_id`). An account handed over without an
   emergency contact (`customer_emergency`) gives it on a screen of its own, saved before the application goes.

**Where people leave** (B1): `community_form_log(p_session, p_events)` gets anonymous events (open, screen reached,
done, error with the question and why, leave with the last screen and question, made, sent), never an answer, a name
or an account; a random id per visit. Staff read the totals in the booking app (Community > Applications > Form
drop-off, `staff_community_form_funnel`).

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

**First question** (the owner, 2026-10-25): "Do you already have a MicroMobility account?". No goes on to step 1.
Yes signs in right here (email or mobile and password, `customer_login`; a Saudi 05X number is sent as +9665X), or on the
booking site for a forgotten password (Google and Apple sign-in ended 2026-11-09). A signed-in account is asked on step 2 only what it does
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
  strings in the sixteen languages, keyed by the English text; a new string is written `k("...")` or `tr("...")` in app.js so the build finds it), logos. The build drops any metadata chunk from
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
