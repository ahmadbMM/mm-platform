# Putting the site on micromobility.sa

The main website takes the root of the domain. Nothing about email, and nothing about the
Petromin registration page, changes.

## How it is wired

- `apps/web` builds with OpenNext into a Cloudflare Worker (`micromobility-web`).
- `apps/web/wrangler.jsonc` binds that Worker to two **routes**: `micromobility.sa/*` and
  `www.micromobility.sa/*`. Routes, not custom domains, on purpose:
  - The DNS records stay exactly as they are. The root and `www` are already proxied A records
    (orange cloud) pointing at the old host; a Worker route answers before that host is asked.
  - The Petromin worker (`mm-partner-register`) holds the more specific route
    `micromobility.sa/petromin*`, and the more specific route wins, so
    `micromobility.sa/petromin` keeps serving the registration form.
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

Every push to `main` builds and deploys the **preview** Worker, `micromobility-web-preview`, to
its `workers.dev` address. It never touches the domain.

## Cutover

Set the repository variable `MM_PRODUCTION` to `on` (Settings > Secrets and variables > Actions >
Variables). From the next push, CI also runs `wrangler deploy --env production`, which claims the
root and `www`. To do it by hand instead: `pnpm --filter web exec wrangler deploy --env production`.

Then check, in this order: `https://micromobility.sa/` (site, redirected to `/en` or `/ar`),
`https://micromobility.sa/petromin` (registration form, unchanged), and send a test email to
an address on the domain. Roll back by deleting the two routes in Workers & Pages >
micromobility-web > Settings > Domains & Routes; the old forward takes over again at once.

## Toolchain notes

- Versions are pinned. Next 16 runs `src/proxy.ts` on the Node runtime; the Cloudflare adapter
  supports that from 1.20.3, marked experimental. If that ever bites, the fallback is Next 15
  with an edge `middleware.ts`.
- ESLint stays on 9.x: the React plugin inside `eslint-config-next` does not load on ESLint 10.
- The Worker bundle is about 2.2 MB compressed. Cloudflare's free Workers plan allows 3 MB; the
  paid plan 10 MB. Worth the paid plan before the site grows much.
- pnpm 11 only runs the build scripts listed under `allowBuilds` in `pnpm-workspace.yaml`.
