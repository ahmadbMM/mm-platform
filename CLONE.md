# Cloning the rentals database into a new Supabase account

Production today: 32 MB, 25 tables, 65 functions, about 1,000 sign-in users, 43 photos (770 kB).
Small enough that the whole copy takes a couple of minutes.

## Before running anything

1. Create the new Supabase account and, in it, a project. Same region as today (ap-south-1) keeps
   latency where it is; note the **project ref** and the **database password**.
2. From each project's dashboard (Connect > Session pooler) copy the connection string.

## The copy

```bash
OLD_DB_URL='…' NEW_DB_URL='…' scripts/clone-database.sh
```

It stops with a non-zero exit if any table's row count differs between the two.

## What the script cannot do

| Item | Where | What to do |
|---|---|---|
| Photo files (43) | Storage > `photos` | Copy the objects across, then rewrite the old project ref inside the URLs stored in `customers.photo` and `inventory.photo`. |
| Sign-in settings | Authentication | Re-enter providers (email, Google), Site URL and redirect list, and any SMTP. Add the new project's `/auth/v1/callback` to the Google OAuth client. |
| Edge functions | Edge Functions | Deploy `supabase/functions/*` from this repo; re-create their secrets. |
| Realtime | Database > Publications | The script replays the table list; confirm it is on for the project. |
| API keys | Settings > API | The anon key changes. Everything that embeds it must be repointed (below). |

## It is a snapshot

The rentals app writes to the old database every night. So:

- **Now:** clone once and build the new website against the copy.
- **Cutover night, in a closed window:** run the clone again, then repoint, in the same hour,
  everything that holds the old project's URL and anon key:
  - the rentals app (`app.src.html`, then `npm run build:html`, push),
  - the two registration forms this site serves (`forms/`): the project's URL and anon key are
    written into `forms/petromin/src/live-submit.js` and `forms/community/design/app.js`, and the
    URL again as the `preconnect` in `forms/petromin/scripts/merge-design.mjs` and
    `forms/community/scripts/build.mjs`; then `npm run build` in each form and commit the
    `src/page.html` it writes (CI checks they match). The headers the site sends with the forms
    take the host from `NEXT_PUBLIC_SUPABASE_URL` (`apps/web/src/forms/headers.ts`), so they
    follow the variables below,
  - this site (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, locally and as
    repository variables).
- Keep the old project alive for a rollback window, as was done on 4 July.

The old organisation is over its Supabase quota with a restriction date of 3 October 2026, so the
cutover has a natural deadline.
