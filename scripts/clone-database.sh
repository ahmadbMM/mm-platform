#!/usr/bin/env bash
# Clone the live rentals database into a new Supabase project (a different account is fine).
#
#   OLD_DB_URL  connection string of the project being copied   (Dashboard > Connect > Session pooler)
#   NEW_DB_URL  connection string of the empty new project      (same place, new account)
#
#   OLD_DB_URL='postgresql://postgres.<old-ref>:<password>@...:5432/postgres' \
#   NEW_DB_URL='postgresql://postgres.<new-ref>:<password>@...:5432/postgres' \
#   scripts/clone-database.sh
#
# What is copied: the whole `public` schema (tables, data, functions, triggers, policies, grants),
# the sign-in users (auth.users + auth.identities, so staff and Google sign-ins keep working with
# the same passwords), the storage bucket rows, and the migration history.
# What is NOT copied by SQL and has its own step below: the photo files, auth settings
# (providers, redirect URLs, SMTP), and edge functions.
#
# It is a SNAPSHOT. The rentals app keeps writing to the old project until it is repointed, so
# run it once now to build against, and once more in a closed window on cutover night.
set -euo pipefail
: "${OLD_DB_URL:?set OLD_DB_URL}"; : "${NEW_DB_URL:?set NEW_DB_URL}"
work="$(mktemp -d)"; echo "working in $work"

echo "1/6 dumping public schema + data"
pg_dump "$OLD_DB_URL" --schema=public --no-owner --quote-all-identifiers -f "$work/public.sql"

echo "2/6 dumping sign-in users, storage buckets, migration history (data only)"
pg_dump "$OLD_DB_URL" --data-only --no-owner \
  -t auth.users -t auth.identities -t storage.buckets -t supabase_migrations.schema_migrations \
  -f "$work/platform-data.sql"

echo "3/6 restoring into the new project"
# New projects ship an empty public schema with Supabase's default grants; start from a clean one.
psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -c 'drop schema if exists public cascade; create schema public;'
psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f "$work/public.sql"
psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -c 'create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);'
psql "$NEW_DB_URL" -v ON_ERROR_STOP=0 -f "$work/platform-data.sql"   # a pre-existing row is not fatal

echo "4/6 grants (projects created since 2025 do not grant these by default; this broke the last migration)"
psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on functions to service_role;
alter default privileges in schema public grant all on sequences to service_role;
SQL

echo "5/6 realtime: same tables published as on the old project"
psql "$OLD_DB_URL" -At -c "select format('alter publication supabase_realtime add table %I.%I;', schemaname, tablename) from pg_publication_tables where pubname='supabase_realtime'" > "$work/realtime.sql"
psql "$NEW_DB_URL" -v ON_ERROR_STOP=0 -f "$work/realtime.sql"

echo "6/6 verifying row counts"
q="select table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::bigint as n from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1"
diff <(psql "$OLD_DB_URL" -At -c "$q") <(psql "$NEW_DB_URL" -At -c "$q") && echo "row counts match on every public table" || { echo "ROW COUNTS DIFFER (above)"; exit 1; }
diff <(psql "$OLD_DB_URL" -At -c "select count(*) from auth.users") <(psql "$NEW_DB_URL" -At -c "select count(*) from auth.users") && echo "sign-in users match"
diff <(psql "$OLD_DB_URL" -At -c "select proname, prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1,2") \
     <(psql "$NEW_DB_URL" -At -c "select proname, prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1,2") && echo "functions and their SECURITY DEFINER flags match"
echo "done. Next: copy the photo files and rewrite their URLs (see CLONE.md)."
