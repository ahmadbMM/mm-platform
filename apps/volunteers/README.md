# volunteer.micromobility.sa

The volunteers' portal: a Worker and a static client (vanilla TypeScript, no framework), signed in
with a MicroMobility account. Since the rework of 2026-11-09 it is a standing team's home: a short
profile and staff's yes once, then one tap per opportunity; Home with the next shift, the hours and
what each event worked gave (a free ride code and its certificate); Updates; the one-screen work
page; the team lead's team. Everything it may do is decided by the booking site's database
(`volunteer_*` functions, rentals migrations `20261105120000` onwards, the rework `20261109120000`,
the enhancements `20261111140000`); this page only asks.

| Address | Page |
| --- | --- |
| `#me`, the bare address | Home (`src/client/home.ts`) |
| `#opps`, `#o/<session>` | Opportunities (`opps.ts`); `#o/` also opens a closed one the volunteer had a shift on |
| `#updates` | Updates (`updates.ts`) |
| `#profile` (`#apply`) | Profile, language, notifications, sign out (`profile.ts`) |
| `#work/<session>`, `#team/<session>` | the work page and the lead's team (`work.ts`) |
| `#cert`, `#check/<code>` | certificates and the volunteer record, and a certificate's check, open to anyone (`certs.ts`) |
| `GET /cal/<session>.ics` | the volunteer's own shift as a calendar file, from the Worker (`src/worker/app.ts`) |

The look is the booking app's rider "Liquid" (its `styles.css`, CUSTOMER SYSTEM and LIQUID): Rubik,
self-hosted from `static/fonts` (copied from the booking site's `fonts/`), IBM Plex Sans Arabic for
Urdu. No inline style or script anywhere: the page's policy (`src/worker/headers.ts`) refuses them.

Online only, with a kept shell: nothing of the volunteer's is kept on the phone but the language, the
page to come back to after a sign-in, the plan prompts skipped and the one-time Home Screen how-to.
A mark on the work page that does not get through says "Not sent" and is sent again by itself, from
the page's memory, when the connection is back. `static/sw.js` keeps the app's shell (the owner's
decision 11, 2026-11-11): a page load goes to the network first and, without one, the kept shell
opens and says the portal is offline. The shell is kept under `/` only, never `/index.html`
(Cloudflare redirects it, and a response with redirect history cannot answer a page load);
`scripts/build.mjs` writes the worker's `CACHE` (named by what it keeps, so each release starts its
own and drops the last) and `SHELL`. The e2e suite blocks service workers except in its offline test.

Phone notifications: the same worker shows a push and opens the portal when it is tapped. They stay
off (`PUSH_SWITCH=false` in `src/client/push.ts`); the page would subscribe through the booking app's
own `customer_push_subscribe`.

## What the enhancements of 2026-11-11 added

The research round's report (`reports/Volunteer portal enhancements.md` in the booking site's repo):
all nineteen quick fixes, Tier 1 and Tier 2, and the decisions that can be built. Every field the
database added is optional on this side: a database from before `20261111140000` draws as before
(the e2e stub's `/__old` checks it).

- **Home** opens with one next-step card, one action: details the account owes (with Add details to
  the booking app's account page), the profile, waiting for staff, the event-day Today card (role,
  time, meeting point, briefing, the staff contact, Start work), "Still coming?" from 48 hours before
  (`volunteer_coming`), "What time will you leave?" (`volunteer_plan`, may be skipped), the close-out
  of an event worked in the last seven days (thanks, what the evening did, the hours, the certificate
  and Share, the Volunteer badge, "A free ride, with our thanks" with Book a ride, the team's note, how
  it was via `volunteer_feedback`, the next opportunity), then the next opportunity. No 0 / 0 for
  someone new; the hours ladder says what was done; the team's year without names; the reward the
  volunteer's motive names comes first (`volunteer_motive`: cv, community, people, learn, active).
- **Calendar**: Add to calendar on acceptance, on the opportunity and on every row coming up, as the
  Worker's `/cal/<session>.ics` (text/calendar, reminders a day and two hours before; `src/client/ics.ts`
  is shared with the Worker) or a Google Calendar link.
- **The opportunity**: what staff wrote for the day (meeting point and map, what to bring, what is
  provided, the T-shirt, what to expect, the partner, the skills), women only / men only, "Register
  before" only when it is before the event, roles and places as lines (chips say a state only), a
  decline's reason, and "I can no longer help" on an accepted place asked first, with an optional reason.
- **Certificates**: Share (the check link, Copy, LinkedIn's Add to profile with the credential ID and
  link shown to paste); the template's new placeholders (below), the QR drawn here on a canvas
  (`src/client/qr.ts`, the website's `qrcode-generator` in a chunk of its own); the volunteer record
  lists every hour, hours staff added with no session among them, with a certificate for any dates.
- **The work page**: no tab bar on a phone; the search as big as Scan and first, keeping its text; a
  short sound when a scan finds someone; a torch where the camera has one; one green pill.
- **Everywhere**: a busy spinner on every action; a tab change and a return to the app read the page
  again; a first read that fails says so (a lost connection apart from a fault on our side); success
  shows in place (and is said to a screen reader), never in a bar; phones as +966 5x xxx xxxx; a
  password show/hide; Noto Sans Devanagari and Bengali for Hindi, Nepali and Bengali; a one-time Add to
  Home Screen how-to after the first offer of help (a real Install button on Android).
- **Loading**: the first three calls go at once; `app-<hash>.js`, `app-<hash>.css` and `chunks/` are
  named by their content and kept a year (`src/worker/headers.ts`); the page and `sw.js` are checked
  every time; the first paint is a skeleton.

```bash
npm run build          # dist/, what the Worker serves
npm run dev            # build, then wrangler dev
npm test               # vitest: the Worker's routes and the words
npm run lint           # eslint; npm run typecheck for tsc
```

It deploys when the repository variable `MM_VOLUNTEERS` is `on`.

## The certificate is not drawn here

The certificate a volunteer prints is the company's one design, and it lives in the **booking
site's repo** (`certificate/`, and its README there). Two built files are copied in:

```bash
npm run sync:cert                       # from ~/micromobilityrentals
npm run sync:cert -- ../somewhere/else  # or $RENTALS_DIR
```

That writes `static/certificate.html` and `static/certificate.css`, both committed, and
`scripts/build.mjs` copies them into `dist/`. **Run it again whenever the design changes there**, or
the portal keeps printing the old one while staff print the new one.

`src/client/certs.ts` fetches `certificate.html`, fills its `{{placeholders}}` (since 2026-11-11 also
`{{role}}`, `{{skills}}`, `{{skills_ar}}`, `{{partner}}`, `{{partner_ar}}`, `{{issued}}` and `{{qr}}`, a PNG
data URL of the check page's address; an empty one leaves no line where the template wraps it in its
section), opens a window and prints it. Three things it must keep doing, because the page's own policy allows no script and no
inline style in that window, and because Cloudflare may add a script of its own to HTML it serves:

- run the template through `stripScripts` (`src/client/cert.ts`) before writing it. On the booking
  site the same file comes back from Cloudflare with its Web Analytics beacon in it; nothing in that
  window should load beside a volunteer's name and report the print;

- hand the template `/certificate-fonts.css` as `{{fonts}}` — **never `/app.css`**, which has a
  `.page` of its own that would fight the certificate's 1123x794 one, and the portal's Rubik, which
  the certificate does not use. `scripts/build.mjs` writes that sheet from its own list of the
  certificate's two faces (`CERT_FACES`: Space Grotesk and IBM Plex Sans Arabic);
- fit the name itself (`fitCert`), once the window's fonts are in, and then the skills (SPEC.md,
  amendment 7: their type half a pixel smaller at a time, down to 11px, until the body ends 16px above
  the footer), as the booking app's `_vcFit` does.

And one more, for iPhones: **open the window on the tap** (`openCertWin`), before anything is
awaited, and write the certificate into it afterwards. iPhone Safari refuses a window opened after
a wait and `window.open` gives null; until 2026-11-10 the portal asked the database first and every
Get certificate on an iPhone said "could not be opened". Chromium lets a late window through, so the
e2e suite's `safariWindows` imposes Safari's rule on the certificate tests.

**The wording is not ours either.** `CERT_WORDS` in `src/client/certs.ts` is a copy of the three
lines the booking site's database stamps on every certificate (`_vol_cert_words`), kept for a
certificate issued before the database stamped them. It says *his* / *her* / neither by gender, and
whoever changes the wording in the booking site must change it here too - nothing in either repo's
tests can see both.

`e2e/volunteers` drives the whole of it against `stub-db.mjs`.
