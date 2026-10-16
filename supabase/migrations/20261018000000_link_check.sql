-- Step 1c: the daily closed-posting check (job-link-check Edge Function) records what each job board said.
-- Two "missing" checks on different days archive the job as Closed (see automation/links/strikes.ts).

alter table public.jobs
  add column if not exists link_checked_at timestamptz,
  add column if not exists link_missing_count smallint not null default 0,
  add column if not exists link_status text;

alter table public.jobs drop constraint if exists jobs_link_status_check;
alter table public.jobs add constraint jobs_link_status_check check (
  link_status is null or link_status in ('open', 'missing', 'unverified')
);

-- The checker's daily read (job-link-check GET).
create index if not exists jobs_user_id_link_check_idx
  on public.jobs (user_id)
  where not archived and status in ('Queued', 'Found', 'Fit Check', 'Ready to Apply', 'Applied', 'Follow-Up');

-- Same as 20261016000000_daily_job_batch.sql, plus the promotion guard: a job with one "missing" strike
-- waits in the queue for its second check instead of being surfaced.
create or replace function private.promote_queued(p_user uuid, p_n integer)
returns integer
language sql
security definer
set search_path = ''
as $$
  with next_batch as (
    select j.id
    from public.jobs j
    where j.user_id = p_user
      and j.status = 'Queued'
      and not j.archived
      and j.link_status is distinct from 'missing'
      and j.created_at >= now() - make_interval(days => private.max_age_days(p_user))
    order by j.match_score desc nulls last, j.created_at asc
    limit greatest(p_n, 0)
    for update skip locked
  ),
  promoted as (
    update public.jobs j
    set status = 'Found', date_found = (now() at time zone 'America/New_York')::date
    from next_batch
    where j.id = next_batch.id
    returning 1
  )
  select count(*)::integer from promoted;
$$;

revoke all on function private.promote_queued(uuid, integer) from public, anon, authenticated;
