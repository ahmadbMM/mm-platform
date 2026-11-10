# volunteer.micromobility.sa

The volunteers' portal: a Worker and a static client (vanilla TypeScript, no framework), signed in
with a MicroMobility account. Since the rework of 2026-11-09 it is a standing team's home: a short
profile and staff's yes once, then one tap per opportunity; Home with the next shift, the hours and
what each event worked gave (a free ride code and its certificate); Updates; the one-screen work
page; the team lead's team. Everything it may do is decided by the booking site's database
(`volunteer_*` functions, rentals migrations `20261105120000` onwards, the rework `20261109120000`);
this page only asks.

| Address | Page |
| --- | --- |
| `#me` | Home (`src/client/home.ts`) |
| `#`, `#o/<session>` | Opportunities (`opps.ts`) |
| `#updates` | Updates (`updates.ts`) |
| `#profile` (`#apply`) | Profile, language, notifications, sign out (`profile.ts`) |
| `#work/<session>`, `#team/<session>` | the work page and the lead's team (`work.ts`) |
| `#cert`, `#check/<code>` | certificates, and a certificate's check, open to anyone (`certs.ts`) |

The look is the booking app's rider "Liquid" (its `styles.css`, CUSTOMER SYSTEM and LIQUID): Rubik,
self-hosted from `static/fonts` (copied from the booking site's `fonts/`), IBM Plex Sans Arabic for
Urdu. No inline style or script anywhere: the page's policy (`src/worker/headers.ts`) refuses them.

Online only: nothing is kept on the phone but the language and the opportunity to come back to after
a sign-in. A mark on the work page that does not get through says "Not sent" and is sent again by
itself, from the page's memory, when the connection is back.

Phone notifications: `static/sw.js` shows a push and opens the portal when it is tapped, and does
nothing else (no fetch handler, no cache). The page subscribes through the booking app's own
`customer_push_subscribe`; the database queues a notification with every update and sends them once
the push keys are set in Cloudflare.

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

`src/client/certs.ts` fetches `certificate.html`, fills its `{{placeholders}}`, opens a window and
prints it. Three things it must keep doing, because the page's own policy allows no script and no
inline style in that window, and because Cloudflare may add a script of its own to HTML it serves:

- run the template through `stripScripts` (`src/client/cert.ts`) before writing it. On the booking
  site the same file comes back from Cloudflare with its Web Analytics beacon in it; nothing in that
  window should load beside a volunteer's name and report the print;

- hand the template `/certificate-fonts.css` as `{{fonts}}` — **never `/app.css`**, which has a
  `.page` of its own that would fight the certificate's 1123x794 one, and the portal's Rubik, which
  the certificate does not use. `scripts/build.mjs` writes that sheet from its own list of the
  certificate's two faces (`CERT_FACES`: Space Grotesk and IBM Plex Sans Arabic);
- fit the name itself (`fitCert`), once the window's fonts are in.

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
