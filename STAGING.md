# Staging: staging.micromobility.sa

A copy of the website for trying changes before they reach micromobility.sa. It runs the same code on
its **own database** with the real site's content (pages, bike catalogue, prices, badges) and
**made-up people** (riders, rides, bookings). No real customer data is ever copied there, so the
privacy notice is not involved, and anything done on staging (sign-ups, forms, bookings) never
reaches production. Only the team can open it (Cloudflare Access).

## How the two stay alike

**Live → staging, automatic.**
- *Code:* every green push to `main` is merged into `staging`, which then builds and deploys
  (ci.yml, job `staging-follow`). Work on staging that is not on main yet is kept (a merge, never a
  reset); a conflict turns that job red for someone to merge by hand.
- *Content:* what the live site shows - page text and settings (site_content), the bike catalogue,
  ride prices, and the uploaded pictures they use - is copied into the staging database every hour,
  after every production deploy, and on demand (Actions > staging-sync > Run workflow).
  `scripts/staging-sync.mjs` reads the live site with the public key (only what the public sees),
  writes only rows that differ, removes rows the live site no longer has, and never touches
  riders, rides or bookings (staging keeps its made-up ones). Staging stays **open**: Coming Soon
  off and every page on, whatever the live site's switches say.
- *Database structure:* a migration is applied to staging first, then production (the Supabase MCP
  sees both projects).

**Staging → live, when approved.** Try a change on `staging`, look at it on staging.micromobility.sa,
then merge it into `main`:

```bash
git switch staging && git pull                       # staging already follows main
# ...commit the change...
git push origin staging                              # tests, then deploys staging only
git switch main && git merge staging && git push origin main   # when it is approved
```

CI uses the same tests for both. On `staging` it builds against `STAGING_SUPABASE_URL` /
`STAGING_SUPABASE_ANON_KEY`, points the two forms at the staging database
(`scripts/point-forms.mjs`), and deploys `wrangler deploy --env staging`. It never deploys
production from `staging`.

## Setting it up (once)

### 1. The staging database

1. In the **new** Supabase account, create a project: name `MicromobilityStaging`, region
   **Frankfurt (eu-central-1)**, same as production. The free plan allows two active projects. A
   free project pauses after a week without use; **Restore** it from the dashboard when needed.
2. Build it: `bash scripts/staging-database.sh`. It asks for production's and staging's Session
   pooler strings, reads production (nothing is written there), and fills staging with:
   production's structure and website content, plus 300 made-up riders over 10 weeks of rides. Every
   check at the end should say OK. Run it again any time to start staging over. More or fewer
   riders: `SEED_ARGS="--riders 500 --weeks 8" bash scripts/staging-database.sh`.
3. **The website's uploaded pictures** (gallery, catalogue photos; the `site` bucket):
   `bash scripts/staging-photos.sh`. It asks for production's Session pooler string and the staging
   project's service_role key, and copies them over. Riders' and staff photos are never copied. Run it
   again whenever staff have uploaded new pictures on the live site.
4. **Your team's sign-in accounts:** staging starts with none. In the staging project, go to
   Authentication > Users > Add user, enter each staffer's work email and a password, then in the SQL
   editor:
   ```sql
   insert into public.staff (user_id, role)
   select id, 'admin' from auth.users where email = 'name@micromobility.sa';
   ```
   (`admin` or `frontdesk`.) Riders sign up on staging like anyone; their accounts stay there.
5. **Authentication > URL Configuration:** Site URL `https://staging.micromobility.sa`, and add
   `https://staging.micromobility.sa/**` to the redirect URLs. Email sign-in works at once. Google
   and Apple need the staging project's callback
   (`https://<staging-ref>.supabase.co/auth/v1/callback`) added to the Google OAuth client and the
   Apple Services ID, as for production.

### 2. GitHub

In the repository: Settings > Secrets and variables > Actions. **Secrets:** `STAGING_SERVICE_KEY` =
the staging project's legacy service_role key (the content copy writes with it). **Variables:**

- `STAGING_SUPABASE_URL` = `https://<staging-ref>.supabase.co`
- `STAGING_SUPABASE_ANON_KEY` = the staging project's **legacy anon** key (Settings > API Keys >
  Legacy API keys)

Until both are set, a push to `staging` builds and tests but deploys nothing.

### 3. Team-only access (Cloudflare Access)

In Cloudflare (the account that holds micromobility.sa): **Zero Trust** (first time: choose a team
name and the **Free** plan, up to 50 people) > Access > Applications > **Add an application** >
Self-hosted:

- Application domain: `staging.micromobility.sa`
- Policy: **Allow**, Include > Emails ending in `@micromobility.sa` (and/or list other emails)
- Login method: **One-time PIN** (a code by email)

Do this **before** the first staging deploy, so the address is never open. The first deploy
creates the `staging.micromobility.sa` DNS record itself (wrangler.jsonc, a custom domain).

## Good to know

- Staging pages have "[Staging]" at the start of their title, every answer is `noindex`, and its
  robots.txt shuts every crawler out (apps/web/worker.js).
- Links from staging to the booking app go to the live booking app, which uses production's
  database. Don't book through them while testing.
- Photos in the copied content load from production's storage (they are public). A photo uploaded
  on staging goes into staging's storage.
- To delete staging: delete the Worker `micromobility-web-staging` and its route in Cloudflare, the
  Access application, and the staging Supabase project.
