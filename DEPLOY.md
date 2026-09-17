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

1. Decide which Supabase project the site talks to and set `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` for it (locally in `apps/web/.env.local`, in CI as
   repository variables). The rentals handoff says: the live rentals project, no migration.
2. Give the store a home the site can link to (for example `store.micromobility.sa` pointed
   at Salla, or a plain link to the Salla address).
3. Add the repository secrets CI needs: `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit, Zone >
   Workers Routes: Edit for micromobility.sa) and `CLOUDFLARE_ACCOUNT_ID`.

## Preview without touching the domain

```bash
pnpm install
pnpm --filter web preview          # builds and serves the Worker locally on :8787
```

To put a preview on the internet without claiming the root, deploy once with the routes
commented out: Cloudflare gives the Worker a `workers.dev` address.

## Cutover

```bash
pnpm --filter web deploy           # or push to main and let CI do it
```

Then check, in this order: `https://micromobility.sa/` (site, redirected to `/en` or `/ar`),
`https://micromobility.sa/petromin` (registration form, unchanged), and send a test email to
an address on the domain. Roll back by deleting the two routes in Workers & Pages >
micromobility-web > Settings > Domains & Routes; the old forward takes over again at once.

## Toolchain notes

- Versions are pinned. Next 16 runs `src/proxy.ts` on the Node runtime; the Cloudflare adapter
  supports that from 1.20.3, marked experimental. If that ever bites, the fallback is Next 15
  with an edge `middleware.ts`.
- ESLint stays on 9.x: the React plugin inside `eslint-config-next` does not load on ESLint 10.
- pnpm 11 only runs the build scripts listed under `allowBuilds` in `pnpm-workspace.yaml`.
