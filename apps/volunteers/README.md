# volunteer.micromobility.sa

The volunteers' portal: a Worker and a static client, signed in with a MicroMobility account.
Volunteers register interest in an opportunity, work a session they were accepted on, see their
hours and print their certificate. Everything it may do is decided by the booking site's database
(`volunteer_*` functions, rentals migrations `20261105120000` onwards); this page only asks.

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

`src/client/main.ts` fetches `certificate.html`, fills its `{{placeholders}}`, opens a window and
prints it. Three things it must keep doing, because the page's own policy allows no script and no
inline style in that window, and because Cloudflare may add a script of its own to HTML it serves:

- run the template through `stripScripts` (`src/client/cert.ts`) before writing it. On the booking
  site the same file comes back from Cloudflare with its Web Analytics beacon in it; nothing in that
  window should load beside a volunteer's name and report the print;

- hand the template `/certificate-fonts.css` as `{{fonts}}` — **never `/app.css`**, which has a
  `.page` of its own that would fight the certificate's 1123x794 one. `scripts/build.mjs` writes
  that sheet from the `@font-face` rules in `static/app.css`, so there is one list of faces;
- fit the name itself (`fitCert`), once the window's fonts are in.

**The wording is not ours either.** `CERT_WORDS` in `src/client/main.ts` is a copy of the three
lines the booking site's database stamps on every certificate (`_vol_cert_words`), kept for the
hours as they stand before any certificate is made. It says *his* / *her* / neither by gender, and
whoever changes the wording in the booking site must change it here too - nothing in either repo's
tests can see both.

`e2e/volunteers` drives the whole of it against `stub-db.mjs`.
