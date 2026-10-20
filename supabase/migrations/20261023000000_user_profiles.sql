-- Phase 1 of multi-user discovery: one search profile per extra user (titles, locations, scoring settings).
-- Joseph's own profile stays in automation/config/profile.json; rows here are for additional users. The daily
-- discovery run reads them through the discovery-profiles Edge Function (service role) and sends each user's
-- jobs to job-intake with that user_id. Profiles are kept out of the public repo, so this table is where they live.
-- Rows are written with the service role (automation/scripts/seed-profile.ts); users can read their own.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  enabled boolean not null default true,
  -- A full Profile (automation/types.ts), validated by automation/rules/profile.ts before every run.
  profile jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

alter table public.user_profiles enable row level security;

drop policy if exists "Users can select their own profile" on public.user_profiles;
create policy "Users can select their own profile"
on public.user_profiles
for select
using (auth.uid() = user_id);

revoke all on public.user_profiles from anon;
revoke all on public.user_profiles from authenticated;
grant select on public.user_profiles to authenticated;
