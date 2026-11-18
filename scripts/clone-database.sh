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
# the same passwords), the storage bucket rows, the storage and realtime security policies (the
# upload rules, which call public functions), and the migration history.
# What is NOT copied by SQL and has its own step below: the photo files, auth settings
# (providers, redirect URLs, SMTP), and edge functions.
#
# It is a SNAPSHOT. The rentals app keeps writing to the old project until it is repointed, so
# run it once now to build against, and once more in a closed window on cutover night. Every run
# REPLACES the new project's public schema, sign-in users and migration history whole, so the
# second run brings the users added and the passwords changed since the first.
#
# Guards (bug hunt 2026-11-18): it refuses production as NEW, the same project twice, and a NEW that
# already holds 50 customers or more (the cutover-night re-run onto the project the first run built
# says so with CLONE_AGAIN=1); and it asks for NEW's project ref to be typed before anything changes.
set -euo pipefail
: "${OLD_DB_URL:?set OLD_DB_URL}"; : "${NEW_DB_URL:?set NEW_DB_URL}"
PROD_REF=qpffkzmsfyilicwcsszz   # production since the 2026-10-02 move
die() { printf '\nSTOPPED: %s\n' "$*" >&2; exit 1; }
ref() { # a connection string's project ref: postgres.<ref>:... (Session pooler) or ...@db.<ref>.supabase.co
  local r; r=$(printf '%s' "$1" | sed -nE 's#.*postgres\.([a-z0-9]{20})[:@].*#\1#p')
  [[ -n "$r" ]] || r=$(printf '%s' "$1" | sed -nE 's#.*@db\.([a-z0-9]{20})\.supabase\.co.*#\1#p')
  printf '%s' "$r"
}
OLD_REF=$(ref "$OLD_DB_URL"); NEW_REF=$(ref "$NEW_DB_URL")
[[ -n "$OLD_REF" && -n "$NEW_REF" ]] || die "could not read a project ref from both strings (use the Session pooler strings)"
[[ "$OLD_REF" != "$NEW_REF" ]] || die "OLD_DB_URL and NEW_DB_URL are the same project ($NEW_REF)"
[[ "$NEW_REF" != "$PROD_REF" ]] || die "NEW_DB_URL is production ($PROD_REF): its public schema would be dropped"
psql "$OLD_DB_URL" -qAtc 'select 1' >/dev/null || die "cannot connect to OLD_DB_URL"
has_cust=$(psql "$NEW_DB_URL" -qAtc "select to_regclass('public.customers') is not null") || die "cannot connect to NEW_DB_URL"
n_cust=0; [[ "$has_cust" != "t" ]] || n_cust=$(psql "$NEW_DB_URL" -qAtc "select count(*) from public.customers")
if [[ "${n_cust:-0}" -ge 50 && "${CLONE_AGAIN:-}" != "1" ]]; then
  die "NEW ($NEW_REF) already holds $n_cust customers. Only for the cutover-night re-run onto the project the first run built: run again with CLONE_AGAIN=1"
fi
echo "OLD = $OLD_REF (only read)   NEW = $NEW_REF ($n_cust customers now; its public schema, sign-in users and migration history are replaced)"
read -rp "Type the NEW project ref to go on: " ans
[[ "$ans" == "$NEW_REF" ]] || die "nothing changed"
work="$(mktemp -d)"; echo "working in $work"

echo "1/6 dumping public schema + data"
pg_dump "$OLD_DB_URL" --schema=public --no-owner --quote-all-identifiers -f "$work/public.sql"

echo "2/6 dumping sign-in users, migration history (data only), storage buckets and storage policies"
pg_dump "$OLD_DB_URL" --data-only --no-owner \
  -t auth.users -t auth.identities -t supabase_migrations.schema_migrations \
  -f "$work/platform-data.sql"
psql "$OLD_DB_URL" -qAt -c "select format('insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (%L, %L, %L, %s, %L::text[]) on conflict (id) do update set name = excluded.name, public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;', id, name, public, coalesce(file_size_limit::text, 'null'), allowed_mime_types) from storage.buckets order by id" > "$work/buckets.sql"
psql "$OLD_DB_URL" -qAt -c "select format('drop policy if exists %I on %I.%I; create policy %I on %I.%I as %s for %s to %s %s %s;', policyname, schemaname, tablename, policyname, schemaname, tablename, permissive, cmd, array_to_string(array(select quote_ident(r) from unnest(roles) r), ', '), case when qual is not null then 'using (' || qual || ')' else '' end, case when with_check is not null then 'with check (' || with_check || ')' else '' end) from pg_policies where schemaname in ('storage', 'realtime') order by schemaname, tablename, policyname" > "$work/policies.sql"

echo "3/6 restoring into the new project"
# New projects ship an empty public schema with Supabase's default grants; start from a clean one.
# Dropping it first also drops public's links to auth.users, so replacing the users next never
# touches a restored row (bike_assignments.assigned_by is "on delete set null"). The sign-in users
# and the migration history are replaced whole, in the same transaction (a refusal leaves the new
# project as it was): a second run used to hit the first run's rows, and one duplicate aborted
# that table's whole COPY unseen.
psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
  -c 'drop schema if exists public cascade; create schema public;' \
  -c 'create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);' \
  -c 'delete from auth.identities; delete from auth.users; delete from supabase_migrations.schema_migrations;' \
  -f "$work/platform-data.sql"
psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -q -f "$work/buckets.sql"
psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f "$work/public.sql"
# The storage upload rules call public functions (_photos_upload_ok, is_admin): set once public is back.
psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -q -f "$work/policies.sql" 2>&1 | grep -v 'does not exist, skipping' || true

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

echo "6/6 verifying"
fail=0
check() { # name, sql: the same answer from both projects, or a FAIL that ends the run non-zero
  if diff <(psql "$OLD_DB_URL" -At -c "$2") <(psql "$NEW_DB_URL" -At -c "$2") > "$work/diff.txt"; then echo "  OK    $1"
  else echo "  FAIL  $1"; sed 's/^/        /' "$work/diff.txt" | head -20; fail=1; fi
}
check "row counts on every public table" "select table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::bigint as n from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1"
# a password changed between two runs keeps the count: compared by a digest, so no password hash is printed
check "sign-in users and their passwords" "select count(*), md5(coalesce(string_agg(id::text || ':' || coalesce(encrypted_password, '') || ':' || coalesce(updated_at::text, ''), ',' order by id), '')) from auth.users"
check "sign-in identities" "select count(*), md5(coalesce(string_agg(id::text || ':' || coalesce(user_id::text, ''), ',' order by id), '')) from auth.identities"
check "migration history" "select version from supabase_migrations.schema_migrations order by 1"
check "storage buckets" "select id, public, file_size_limit, allowed_mime_types from storage.buckets order by 1"
check "storage and realtime policies" "select schemaname, tablename, policyname, cmd, roles::text, coalesce(qual,''), coalesce(with_check,'') from pg_policies where schemaname in ('storage','realtime') order by 1,2,3"
check "functions and their SECURITY DEFINER flags" "select proname, prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1,2"
[[ "$fail" == 0 ]] || { echo "THE COPY DIFFERS (above)"; exit 1; }
echo "done. Next: copy the photo files and rewrite their URLs (see CLONE.md)."
