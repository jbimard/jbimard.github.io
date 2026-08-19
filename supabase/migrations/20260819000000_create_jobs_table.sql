create extension if not exists pgcrypto;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company text not null,
  role_title text not null,
  location text,
  job_link text,
  status text not null default 'Found',
  priority text not null default 'Medium',
  job_type text,
  work_mode text not null default 'Unknown',
  match_score smallint,
  required_skills text,
  sponsorship_notes text,
  start_date date,
  graduation_requirement text,
  e_verify_notes text,
  cover_letter_status text,
  recruiter_contact text,
  job_description text,
  notes text,
  resume_version text,
  date_found date,
  date_applied date,
  follow_up_date date,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_status_check check (
    status in (
      'Found',
      'Fit Check',
      'Tailoring',
      'Ready to Apply',
      'Applied',
      'Follow-Up',
      'Interview',
      'Offer',
      'Rejected',
      'Closed'
    )
  ),
  constraint jobs_priority_check check (priority in ('High', 'Medium', 'Low')),
  constraint jobs_job_type_check check (
    job_type is null
    or job_type in ('New Grad', 'Early Career', 'Rotational Program', 'Internship', 'Part-Time', 'Other')
  ),
  constraint jobs_work_mode_check check (work_mode in ('Remote', 'Hybrid', 'Onsite', 'Unknown')),
  constraint jobs_match_score_check check (match_score is null or match_score between 0 and 100)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
before update on public.jobs
for each row
execute function public.set_updated_at();

create index if not exists jobs_user_id_idx on public.jobs (user_id);
create index if not exists jobs_user_id_archived_idx on public.jobs (user_id, archived);
create index if not exists jobs_user_id_status_idx on public.jobs (user_id, status);
create index if not exists jobs_user_id_follow_up_date_active_idx
  on public.jobs (user_id, follow_up_date)
  where not archived;

alter table public.jobs enable row level security;

drop policy if exists "Users can select their own jobs" on public.jobs;
create policy "Users can select their own jobs"
on public.jobs
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own jobs" on public.jobs;
create policy "Users can insert their own jobs"
on public.jobs
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own jobs" on public.jobs;
create policy "Users can update their own jobs"
on public.jobs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own jobs" on public.jobs;
create policy "Users can delete their own jobs"
on public.jobs
for delete
using (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.jobs to authenticated;
