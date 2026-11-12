# Putting the site on micromobility.sa

The main website takes the root of the domain. Nothing about email, and nothing about the
Petromin registration page, changes.

## How it is wired

- `apps/web` builds with OpenNext into a Cloudflare Worker (`micromobility-web`).
- `apps/web/wrangler.jsonc` binds that Worker to two **routes**: `micromobility.sa/*` and
  `www.micromobility.sa/*`. Routes, not custom domains, on purpose:
  - The DNS records stay exactly as they are. The root and `www` are already proxied A records
    (orange cloud) pointing at the old host; a Worker route answers before that host is asked.
  - `www.micromobility.sa` is not a second copy of the site: the Worker moves every address on it
    to the same path and query on `micromobility.sa` (301; 308 for a POST), before anything else
    (`apps/web/edge/front.js`, `src/lib/canonical-host.ts`).
  - Two Workers since 2026-11-10 (the first visit after a quiet spell took up to 2.5 s, most of it the 23 MB site
    starting on a cold machine even to send a kept page): `micromobility-web`, the front (`apps/web/edge.js`,
    `wrangler.edge.jsonc`, about 11 KB), holds the routes, moves `www`, and answers from the edge's page copies
    (`src/lib/page-cache.ts`); `micromobility-web-site`, the site as OpenNext builds it (`apps/web/site.js`,
    `wrangler.jsonc` env `production`), has no address of its own and is asked through the front's `SITE` service
    binding. CI deploys the site, then the front. The site's logs (page errors, failures) are under
    `micromobility-web-site` in Workers Logs.
  - The two registration forms (`forms/petromin` at `/petromin`, `forms/community` at
    `/community/registration`) are served by this Worker too, outside Coming Soon. Until their
    old Workers' routes are removed (below), those more specific routes still win and the old
    Workers keep answering there.
  - The Defe booking page (`forms/defe`, at `/defe`; the owner, 2026-10-17) was served the same way until the user
    turned it off on 2026-11-09; `/defe` now opens the Saturday ride's page (`proxy.ts` defeTarget). Its source is in
    the git history; its database side (rentals `20261017120000_partner_places.sql`) is still in place.
  - A Worker route runs before the old forward to the Salla store, so the forward stops
    applying the moment this Worker is deployed. Delete the forward afterwards to keep the
    zone tidy (Rules > Redirect Rules in the dashboard, or on the old host if it lives there).

## Do not touch

MX, the two DKIM CNAMEs, `_dmarc`, `_domainkey`, SPF and the Google verification TXT records,
and the `mail`, `autoconfig`, `autodiscover`, `ftp` and `ssh` A records. Company email lives
on the old host; the website moving does not change that.

## Before the first production deploy

1. The site talks to a clone of the rentals database in a new Supabase account (decided
   2026-09-18). See `CLONE.md`. Set `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` for it, locally in `apps/web/.env.local` and in GitHub as
   repository **variables** of the same names.
2. The shop is a hosted Salla store, so it cannot be served from inside a path. The path
   forwards instead: `/store`, `/en/store` and `/ar/store` open it (`apps/web/next.config.ts`).
3. Add the repository **secrets** CI needs: `CLOUDFLARE_API_TOKEN` (Account > Workers Scripts:
   Edit; Zone > Workers Routes: Edit for micromobility.sa) and `CLOUDFLARE_ACCOUNT_ID`.

## Preview without touching the domain

```bash
pnpm install
pnpm --filter web preview          # builds and serves the Worker locally on :8787
```


## Deploys

A push to `main` runs the checks (lint, types, unit tests, then the forms and the site's pages in a
browser) and, only when the repository variable `MM_PRODUCTION` is `on` and the Cloudflare secrets
exist, deploys the one Worker there is: `micromobility-web`, which answers the whole domain (the two
routes in `apps/web/wrangler.jsonc`). There is no preview deploy. The automatic
`micromobility-web-preview` Worker was removed on 2026-09-20 at the owner's request, so a push puts
nothing into the Cloudflare account unasked. To look at a build first, run it locally
(`pnpm --filter web preview`, above) or deploy the default target by hand from `apps/web`
(`npx wrangler deploy`): a copy on a `workers.dev` address, with no claim on the domain.

## Production, and rolling back

The routes claim the root and `www` since 2026-09-24 (before that, `production` listed only the tag
pages' `/b/*`). `MM_PRODUCTION` (Settings > Secrets and variables > Actions > Variables) is the
switch: set to anything but `on`, a push still runs every check and deploys nothing. To deploy by
hand, from `apps/web`: `npx wrangler deploy --env production`, then `npx wrangler deploy -c wrangler.edge.jsonc --env
production`.

After a deploy, check in this order: `https://micromobility.sa/` (the site), `/api/health`,
`https://micromobility.sa/petromin` (the registration form), `/saturday` (the Saturday ride's page), and send a test email to an address on
the domain (CI does the first four, "The live site answers"). Roll back by deleting the two routes in
Workers & Pages > micromobility-web > Settings > Domains & Routes; the old forward takes over again at
once.

## Sign-in protection

The account sign-in (`/api/account`) allows each connection 10 tries a minute, with Cloudflare's
rate limiter (`LOGIN_LIMIT` in `apps/web/wrangler.jsonc`; nothing to set up). The page-error reports
(`/api/log-error`) and the signed-in pop-ups' checks (`/api/account/pending-waiver`,
`/api/account/pending-share`, `/api/account/pending-rating`) allow each connection 30 of each a
minute the same way (`API_LIMIT`).
On top of that the sign-in can ask for a Cloudflare Turnstile check, which is off until both of its
keys exist:

1. Cloudflare dashboard (the account that holds micromobility.sa) > Turnstile > Add widget:
   hostname `micromobility.sa` (and `www.micromobility.sa`), mode Managed.
2. GitHub > mm-platform > Settings > Secrets and variables > Actions > **Variables**: add
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = the widget's site key. Push anything (or re-run the last
   run) so the form is built with it.
3. Only then, the secret key as a Worker secret:
   `cd apps/web && npx wrangler secret put TURNSTILE_SECRET_KEY --env production`.
   The order matters: with the secret set but no site key in the page, every sign-in is refused.

To turn it off again, delete the secret first, then the variable.

## Content Security Policy

`apps/web/next.config.ts` sends it with every page. Scripts and styles from elsewhere are named one
by one: Cloudflare's analytics beacon and Turnstile, and on the live ride map (`/live`) MapLibre's two
files at the pinned version `components/live/LiveMap.tsx` loads (a unit test fails when the two
differ, so a new MapLibre version changes both). The registration forms send their own policy
(`apps/web/src/forms/headers.ts`), which allows the one supabase-js file the Petromin page loads (the Dukan page,
`forms/dukan` at `/dukan`, loads none).

`script-src` keeps `'unsafe-inline'` on purpose: Next writes small inline scripts into every page,
and a nonce - the usual way to allow them without it - must be new on every answer, while the
pages are kept at Cloudflare's edge for a minute and answered to everyone (`src/lib/page-cache.ts`).
A kept copy would carry a nonce that no longer matches. Revisit it only together with that cache.

## Monitoring

- **Workers Logs** are on (`observability` in `apps/web/wrangler.jsonc`): dashboard > Workers & Pages >
  micromobility-web > Logs. A page that fails in a visitor's browser is reported there too, as a
  `page-error` line (`/api/log-error`), with the digest Next shows.
- **Web Analytics** (named in the Privacy Notice): dashboard > Analytics & Logs > Web Analytics >
  Add a site > micromobility.sa. Either choose the automatic setup (Cloudflare adds the beacon;
  nothing else to do), or copy the site token into the repository **variable**
  `NEXT_PUBLIC_CF_BEACON_TOKEN` and push, and the site adds it itself. Not both.
- **Uptime**: point a monitor (UptimeRobot's free plan, 5-minute checks, alerts by email or app)
  at `https://micromobility.sa/api/health` (200 when the site can read the database, 503 when it
  cannot), and at `/petromin` and `/dukan` on ride nights.
- **CI** checks the site's pages in a browser before every deploy (`e2e/site`), and the live
  addresses after it ("The live site answers").

## Toolchain notes

- Versions are pinned. Next 16 runs `src/proxy.ts` on the Node runtime; the Cloudflare adapter
  supports that from 1.20.3, marked experimental. If that ever bites, the fallback is Next 15
  with an edge `middleware.ts`.
- ESLint stays on 9.x: the React plugin inside `eslint-config-next` does not load on ESLint 10.
- The site's Worker bundle is about 5.8 MB compressed as wrangler measures it (`wrangler deploy --dry-run`,
  2026-11-10; 3.3 MB on 2026-09-27, 2.2 MB when the site was a few pages); the front's is 3.7 KB. Cloudflare's paid
  Workers plan allows 10 MB.
- pnpm 11 only runs the build scripts listed under `allowBuilds` in `pnpm-workspace.yaml`.

## Limits

**CPU.** The Workers Free plan allows 10 ms of CPU per request. Each Worker instance tolerates an
occasional request over that; one that runs over it consistently is stopped, and the visitor gets
Cloudflare's "Error 1102: Worker exceeded resource limits" (a 503). Rendering any page of this site
costs more than 10 ms. Measured on staging with `wrangler tail` on 2026-10-05: a page render took
15-70 ms of CPU (median about 30 ms), a freshly started Worker instance 0.5-0.7 s for its first
page, and 27 of 114 page requests were stopped at 10 ms (`"outcome": "exceededCpu"`). Production
runs the same code, so it will do the same once Coming Soon is off. No change to the pages brings a
Next.js render under 10 ms. The fix is the **Workers Paid plan** (US$5 a month at the time of
writing; 30 s of CPU per request by default), on the Cloudflare account that holds the Workers. Until
then the site keeps answering 1102 to some visitors.

What the code does to keep the CPU down:
- Links never prefetch (`src/i18n/navigation.ts`). Each prefetch is a page the Worker renders: a
  desktop visit to Home was 17 Worker requests, 13 of them prefetches; now it is 3 (the page and the
  two account checks), and a click on a link renders only the page it opens.
- A page that cannot differ between visitors is answered from the edge's copy for a minute
  (`src/lib/page-cache.ts`), and what the pages read from the database is kept for a minute per
  Worker instance (`src/lib/memo.ts`).
- Formatters and the like are made once, not on every request (`riyadhClock`, next-intl's time zone).

**Time.** Every read from the database or storage has its own timeout: 2.5 s for the site's content,
the catalogue, the rides and the staff check; 4 s for the account calls, GPX tracks and `/api/health`;
5 s for the Turnstile check; 8 s for the bike pages, photos and the wallet pass. A read that several requests share
(`src/lib/memo.ts`) is waited for 5 s at most by a request with nothing to show (it then takes the
edge's copy), and one still pending after 15 s is replaced. That read can be lost for good when the
request that started it is stopped (error 1102, or the visitor leaving), and before this every later
request in that Worker instance waited on it.

To look again: `cd apps/web && npx wrangler tail micromobility-web-staging --format json` (or
`micromobility-web`) while opening pages; each request's line has `outcome` and `cpuTime`.

## Moving the two forms onto this Worker (once)

The forms used to be Workers of their own: `mm-partner-register` (routes
`micromobility.sa/petromin*`, `www.micromobility.sa/petromin*`) and `mm-community-register`
(routes `micromobility.sa/community/registration*`, `www.micromobility.sa/community/registration*`).
This Worker now serves the same pages at the same addresses, but a more specific route wins, so:

1. Merge the change that brought `forms/` in; CI tests the forms and deploys this Worker.
   Nothing changes for riders yet.
2. Cloudflare dashboard (the account that holds the micromobility.sa zone) > Workers & Pages >
   each of the two Workers > Settings > Domains & Routes: delete its two routes. Not on a
   Petromin ride night.
3. Open https://micromobility.sa/petromin and https://micromobility.sa/community/registration:
   the same forms, now answered by `micromobility-web`.

To go back, add the routes again (or `npx wrangler deploy` in the old repos). Once it has run a
week without trouble, the two old Workers can be deleted.


## The vendor portal (apps/vendors)

Restaurants and cafes sign in here to reserve the Saturdays our riders come for breakfast
(database: migration `20261003150000_fnb_partners.sql` in the rentals repo, whose `fnb_*` names are
`vendor_*` now). A small Worker of its own, `micromobility-vendors` (named `micromobility-partners` until 2026-10-03), not part of the website: plain
TypeScript, bundled by esbuild.

- Run it locally: `pnpm --filter vendors dev` (builds `dist/`, then `wrangler dev` on :8787,
  against the production database named in `apps/vendors/wrangler.jsonc`; use
  `--env staging` for staging's). Tests: `pnpm --filter vendors test` (unit) and
  `cd e2e/vendors && npm ci && npm run e2e` (a browser against a stub database).
- Deploys: CI deploys it only while the repository variable `MM_VENDORS` is `on` (main →
  production, staging branch → `micromobility-vendors-staging`). Production answers at
  **vendors.micromobility.sa** (a Workers custom domain in its `wrangler.jsonc`; Cloudflare made
  the DNS record), staging on its workers.dev address.
- The venue's session token stays on the server: the Worker keeps it in an HttpOnly cookie
  (`mm_vendor`, host-only) and forwards only the allowlisted `vendor_*` functions.
- Since rentals migration `20261004130000_vendor_portal_hardening.sql` (apply it BEFORE deploying the
  portal that reads its answers): every sign-in is its own session in the database (`vendor_sessions`,
  only the token's hash; 30 days, or 14 days unused), Sign out ends it there (`/api/logout` calls
  `vendor_logout`), a temporary password lasts 72 hours and must be changed before anything else, and
  logins are owner / manager / viewer.
- Optional gate (off until switched on): with the Worker secret `VENDOR_GATE_SECRET` set, sign-in
  sends it as the `x-vendor-gate` header, and once its sha256 is stored in `public.vendor_gate` the
  database accepts sign-in only through this Worker. Switch it on in this order:
  1. `openssl rand -hex 32` (keep it in the password manager);
  2. `cd apps/vendors && npx wrangler secret put VENDOR_GATE_SECRET` (and `--env staging` for staging);
  3. in the SQL editor of the same database:
     `insert into public.vendor_gate (secret_hash) values (encode(sha256(convert_to('<secret>', 'UTF8')), 'hex'));`
  Off again: `delete from public.vendor_gate;` (the secret may stay). The other way round (the row
  before the secret) refuses every sign-in until the secret is in place.
- The portal's privacy notice (`#privacy`, `src/client/privacy.ts`) is a DRAFT until the owner
  approves it; nobody is asked to accept it.

### The volunteer portal (apps/volunteers)

A small Worker of its own, on the vendor portal's pattern: `volunteer.micromobility.sa`, where anyone reads the
opportunities (a session with the volunteer switch on), anyone with a MicroMobility account registers interest, and those
staff accept work (rentals migration `20261105120000_volunteers.sql`; apply it BEFORE the first deploy).

- A volunteer is a customer account: sign-in is the booking app's `customer_login`, the same email or mobile and password.
  Creating an account and a forgotten password happen on the booking app
  (`?handoff=volunteer`), which hands the rider back with a one-time code (`?signin=<code>`, `customer_handoff_redeem`),
  as My Account's button does.
- The token stays on the server: the Worker keeps it in an HttpOnly, host-only cookie (`mm_volunteer`) and forwards only the
  allowlisted `volunteer_*` functions (`RPCS` in `src/worker/app.ts`), with `p_id` and `p_token` from the cookie. Signing out
  clears the cookie and leaves the token, which is the account's: ending it would sign the rider out of the booking app.
- Run it locally: `pnpm --filter volunteers dev`. Tests: `pnpm --filter volunteers test` (unit) and
  `cd e2e/volunteers && npm ci && npm run e2e` (a browser against a stub database).
- Deploys: CI deploys it only while the repository variable `MM_VOLUNTEERS` is `on` (main → production, staging branch →
  `micromobility-volunteers-staging`). The address is a Workers custom domain in its `wrangler.jsonc`; Cloudflare makes the
  DNS record on the first deploy.
- Words: `src/lang/<code>.json`, the booking app's ten languages; English rides in the bundle, the others are fetched when
  chosen. `test/words.test.ts` fails when a language misses a word.
