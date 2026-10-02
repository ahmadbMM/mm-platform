#!/usr/bin/env bash
# Build (or rebuild) the STAGING database: production's structure, production's website content,
# and made-up people. No real customer, booking or application ever leaves production.
#
#   bash scripts/staging-database.sh
#
# It asks for two connection strings (Dashboard > Connect > "Session pooler", password filled in):
# production (read only: nothing is written there) and the staging project (EVERYTHING in its
# public schema is replaced). They are shown as you paste them and never saved; clear the
# Terminal afterwards (Cmd+K).
#
# What staging gets:
#   - the whole public schema without its data: tables, functions, triggers, policies, grants
#   - the migration history, so `supabase db push` against staging knows where it stands
#   - the storage buckets and the storage / live-update rules, as on production
#   - the website's CONTENT (CONTENT_TABLES below): pages, bike catalogue, prices, badges, tags,
#     shop items. None of it is personal.
#   - made-up riders, rides, bookings and bikes from the booking app's scripts/seed-staging.mjs
#     (RENTALS_DIR, default ~/micromobilityrentals)
# What it does not get: sign-in accounts (add the team's own in the staging dashboard, STAGING.md),
# photos of people, and anything else with a person in it.
set -euo pipefail
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"
PROD_REF=qpffkzmsfyilicwcsszz
RENTALS_DIR="${RENTALS_DIR:-$HOME/micromobilityrentals}"
CONTENT_TABLES=(site_content catalog_spec_fields catalog_categories catalog_models catalog_colors catalog_photos
                badges breakfast_spots ride_prices ride_prices_by_kind tags inventory staff_options)
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { printf '\n\033[31mSTOPPED: %s\033[0m\n' "$*"; exit 1; }

[[ -f "$RENTALS_DIR/scripts/seed-staging.mjs" ]] || die "no booking-app checkout at $RENTALS_DIR (set RENTALS_DIR)"
read -rp "PRODUCTION database connection string (Session pooler): " PROD_DB_URL
read -rp "STAGING database connection string (Session pooler):    " STG_DB_URL
[[ "$PROD_DB_URL" == *"$PROD_REF"* ]] || die "the PRODUCTION string does not contain $PROD_REF"
STG_REF=$(printf '%s' "$STG_DB_URL" | sed -nE 's#.*postgres\.([a-z0-9]{20})[:@].*#\1#p')
[[ -n "$STG_REF" ]] || die "could not read the project ref from the STAGING string (use the Session pooler string)"
[[ "$STG_REF" != "$PROD_REF" ]] || die "the STAGING string is production"
[[ "$STG_REF" != "amyqxovbnlreassrqihr" ]] || die "the STAGING string is the old production project"
psql "$PROD_DB_URL" -qAtc 'select 1' >/dev/null || die "cannot connect to PRODUCTION"
psql "$STG_DB_URL" -qAtc 'select 1' >/dev/null || die "cannot connect to STAGING"
# A staging project never has the team's company-domain staff in it from a copy; if it holds
# many customers it is probably not staging.
n_cust=$(psql "$STG_DB_URL" -qAtc "select case when to_regclass('public.customers') is null then 0 else (select count(*) from public.customers where id not like 'stg-%') end" 2>/dev/null || echo 0)
[[ "${n_cust:-0}" -lt 50 ]] || die "STAGING already holds $n_cust customers that the seed did not make: is this really staging?"
echo "production = $PROD_REF   staging = $STG_REF"
read -rp "Type STAGING to replace everything in the staging database: " ans
[[ "$ans" == "STAGING" ]] || die "nothing changed"

work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT

say "1/6 reading production's structure and content (production is only read)"
pg_dump "$PROD_DB_URL" --schema=public --schema-only --no-owner --quote-all-identifiers -f "$work/schema.sql"
pg_dump "$PROD_DB_URL" --schema=supabase_migrations --no-owner -f "$work/migrations.sql"
targs=(); for t in "${CONTENT_TABLES[@]}"; do targs+=(-t "public.$t"); done
pg_dump "$PROD_DB_URL" --data-only --no-owner "${targs[@]}" -f "$work/content.sql"
psql "$PROD_DB_URL" -qAt -c "select format('insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (%L, %L, %L, %s, %L::text[]) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;', id, name, public, coalesce(file_size_limit::text, 'null'), allowed_mime_types) from storage.buckets order by id" > "$work/buckets.sql"
psql "$PROD_DB_URL" -qAt -c "select format('drop policy if exists %I on %I.%I; create policy %I on %I.%I as %s for %s to %s %s %s;', policyname, schemaname, tablename, policyname, schemaname, tablename, permissive, cmd, array_to_string(array(select quote_ident(r) from unnest(roles) r), ', '), case when qual is not null then 'using (' || qual || ')' else '' end, case when with_check is not null then 'with check (' || with_check || ')' else '' end) from pg_policies where schemaname in ('storage', 'realtime') order by schemaname, tablename, policyname" > "$work/policies.sql"
psql "$PROD_DB_URL" -qAtc "select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' order by 1" > "$work/realtime.txt"
node "$RENTALS_DIR/scripts/seed-staging.mjs" ${SEED_ARGS:-} > "$work/seed.sql"

say "2/6 clearing staging"
psql "$STG_DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
drop schema if exists public cascade;
drop schema if exists supabase_migrations cascade;
SQL
grep -qE '^CREATE SCHEMA "?public"?;' "$work/schema.sql" || psql "$STG_DB_URL" -v ON_ERROR_STOP=1 -qc 'create schema public;'

say "3/6 structure, migration history, grants, buckets and rules"
psql "$STG_DB_URL" -v ON_ERROR_STOP=1 -q -f "$work/schema.sql" > /dev/null
psql "$STG_DB_URL" -v ON_ERROR_STOP=1 -q -f "$work/migrations.sql" > /dev/null
psql "$STG_DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on functions to service_role;
alter default privileges in schema public grant all on sequences to service_role;
SQL
psql "$STG_DB_URL" -v ON_ERROR_STOP=1 -q -f "$work/buckets.sql"
psql "$STG_DB_URL" -v ON_ERROR_STOP=1 -q -f "$work/policies.sql" 2>&1 | grep -v 'does not exist, skipping' || true
while read -r t; do
  [[ -z "$t" ]] && continue
  psql "$STG_DB_URL" -v ON_ERROR_STOP=1 -qc "do \$\$ begin if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='$t') then execute 'alter publication supabase_realtime add table public.\"$t\"'; end if; end \$\$;"
done < "$work/realtime.txt"

say "4/6 the website's content"
psql "$STG_DB_URL" -v ON_ERROR_STOP=1 -q -f "$work/content.sql" > /dev/null
# Loading the content fired the history and audit triggers; staging starts with no history.
psql "$STG_DB_URL" -v ON_ERROR_STOP=1 -qc "truncate public.site_content_history, public.audit_log;"

say "5/6 made-up riders, rides, bookings and bikes"
# Each made-up customer fires the staff live-update trigger; a new project has no live-update
# storage yet, so the database warns once per row (WarnSendingBroadcastMessage) and carries on.
if ! psql "$STG_DB_URL" -v ON_ERROR_STOP=1 -q -f "$work/seed.sql" > /dev/null 2> "$work/seed.err"; then
  grep -v 'WarnSendingBroadcastMessage' "$work/seed.err" | tail -20; die "the made-up data did not load (above)"
fi
grep -v 'WarnSendingBroadcastMessage' "$work/seed.err" | tail -20 || true

say "6/6 checking staging"
fail=0
check() { # name, sql
  if diff <(psql "$PROD_DB_URL" -qAtc "$2") <(psql "$STG_DB_URL" -qAtc "$2") > "$work/diff.txt"; then echo "  OK    $1"
  else echo "  FAIL  $1"; sed 's/^/        /' "$work/diff.txt" | head -20; fail=1; fi
}
check "functions and SECURITY DEFINER flags" "select p.proname, p.prosecdef, pg_get_function_identity_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1,3"
check "security policies"                     "select schemaname, tablename, policyname, cmd, roles::text, coalesce(qual,''), coalesce(with_check,'') from pg_policies where schemaname in ('public','storage','realtime') order by 1,2,3"
check "table grants"                          "select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') order by 1,2,3"
check "function grants"                       "select routine_name, grantee from information_schema.role_routine_grants where routine_schema='public' and grantee in ('anon','authenticated','PUBLIC') order by 1,2"
check "triggers"                              "select event_object_table, trigger_name, event_manipulation from information_schema.triggers where trigger_schema='public' order by 1,2,3"
check "row security switched on"              "select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' order by 1"
check "migration history"                     "select version from supabase_migrations.schema_migrations order by 1"
# Content: every production row is there (the seed may add a few defaults of its own on top).
for t in "${CONTENT_TABLES[@]}"; do
  p=$(psql "$PROD_DB_URL" -qAtc "select count(*) from public.$t"); s=$(psql "$STG_DB_URL" -qAtc "select count(*) from public.$t")
  if [[ "$s" -ge "$p" ]]; then echo "  OK    content: $t ($p)"; else echo "  FAIL  content: $t has $s of production's $p"; fail=1; fi
done
echo "  made up: $(psql "$STG_DB_URL" -qAtc "select (select count(*) from public.customers) || ' riders, ' || (select count(*) from public.sessions) || ' rides, ' || (select count(*) from public.queue_entries) || ' bookings, ' || (select count(*) from public.bikes) || ' bikes'")"
real=$(psql "$STG_DB_URL" -qAtc "select count(*) from public.customers where email not like '%@example.%' and email is not null and email <> ''")
[[ "$real" == "0" ]] && echo "  OK    no customer with a real-looking email" || { echo "  FAIL  $real customers with a real-looking email"; fail=1; }

if [[ "$fail" == "0" ]]; then say "Staging is ready. Next: bash scripts/staging-photos.sh (the website's pictures), then the team's sign-in accounts (STAGING.md)."
else say "Staging was built but some checks FAILED (above)."; exit 1; fi
