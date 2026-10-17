-- Step 4: the visa timeline card at the top of /jobs. One row per user, dates only; everything else (OPT and STEM OPT
-- filing windows, the unemployment counter, H-1B registrations) is worked out in the browser from these dates.
-- Never add document numbers here (A-number, SEVIS ID, EAD card number, receipt numbers).

create table if not exists public.visa_profile (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  -- Program end date from the I-20.
  program_end_date date not null,
  -- From the OPT and STEM OPT EAD cards once approved. Null until then.
  opt_start_date date,
  opt_end_date date,
  stem_opt_end_date date,
  -- Unemployment counter: days already used in earlier gaps, plus the current gap (null while working).
  unemployed_days_logged integer not null default 0,
  unemployed_since date,
  updated_at timestamptz not null default now(),
  constraint visa_profile_opt_dates_check check (opt_end_date is null or opt_start_date is null or opt_end_date > opt_start_date),
  constraint visa_profile_stem_dates_check check (stem_opt_end_date is null or opt_end_date is null or stem_opt_end_date > opt_end_date),
  constraint visa_profile_unemployed_days_check check (unemployed_days_logged between 0 and 365)
);

drop trigger if exists visa_profile_set_updated_at on public.visa_profile;
create trigger visa_profile_set_updated_at
before update on public.visa_profile
for each row
execute function public.set_updated_at();

alter table public.visa_profile enable row level security;

drop policy if exists "Users can select their own visa profile" on public.visa_profile;
create policy "Users can select their own visa profile"
on public.visa_profile
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own visa profile" on public.visa_profile;
create policy "Users can insert their own visa profile"
on public.visa_profile
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own visa profile" on public.visa_profile;
create policy "Users can update their own visa profile"
on public.visa_profile
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own visa profile" on public.visa_profile;
create policy "Users can delete their own visa profile"
on public.visa_profile
for delete
using (auth.uid() = user_id);

revoke all on public.visa_profile from anon;
grant select, insert, update, delete on public.visa_profile to authenticated;
