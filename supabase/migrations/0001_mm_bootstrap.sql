-- 0001: mm schema bootstrap (identity module + conventions)
-- Run on the new site's OWN Supabase project (see CLONE.md); it does not exist yet, so this
-- has not been run anywhere. Additive only; never touches public.*
-- NOT ariyvnxeywozmwxmylhb: that is the old rentals rollback copy, not staging for this site.
-- After applying: Dashboard > Settings > API > add 'mm' to Exposed schemas.

create schema if not exists mm;
grant usage on schema mm to anon, authenticated, service_role;
alter default privileges in schema mm grant all on tables to service_role;
-- No default grants to anon/authenticated: every table opts in explicitly.

create extension if not exists pgcrypto;

create or replace function mm.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- staff
create table mm.staff_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','manager','frontdesk','technician','finance','content')),
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now()
);

create or replace function mm.is_staff(required_roles text[] default null)
returns boolean language sql stable security definer set search_path = mm, public as $$
  select exists (
    select 1 from mm.staff_roles s
    where s.user_id = auth.uid()
      and (required_roles is null or s.role = any(required_roles))
  );
$$;

-- customer identity
create table mm.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  legacy_id text unique,                -- link to public.customers.id after claim
  name text,
  phone text unique,                    -- E.164
  email text,
  lang text not null default 'en' check (lang in ('en','ar')),
  height_cm int,
  marketing_optin boolean not null default false,  -- PDPL consent flag
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);
create trigger trg_profiles_updated before update on mm.profiles
  for each row execute function mm.set_updated_at();

create or replace function mm.handle_new_user() returns trigger
language plpgsql security definer set search_path = mm, public as $$
begin
  insert into mm.profiles (id, phone, email)
  values (new.id, nullif(new.phone,''), nullif(new.email,''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created_mm on auth.users;
create trigger on_auth_user_created_mm after insert on auth.users
  for each row execute function mm.handle_new_user();

-- RLS
alter table mm.profiles enable row level security;
alter table mm.staff_roles enable row level security;

grant select, update on mm.profiles to authenticated;
grant select on mm.staff_roles to authenticated;

create policy profiles_read on mm.profiles for select to authenticated
  using (id = auth.uid() or mm.is_staff());
create policy profiles_self_update on mm.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy staff_roles_read on mm.staff_roles for select to authenticated
  using (mm.is_staff());
-- staff_roles writes: service_role only (no authenticated policy on purpose)
