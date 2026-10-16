-- Step 1b: discovery sends every job as 'Queued' (hidden from the dashboard). Each morning the best
-- daily_batch_size queued jobs move to 'Found', and the dashboard's "Next batch" button moves the next ones.

alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs add constraint jobs_status_check check (
  status in (
    'Queued',
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
);

create index if not exists jobs_user_id_queue_idx
  on public.jobs (user_id, match_score desc nulls last, created_at)
  where status = 'Queued' and not archived;

-- Per-user batch settings. No row means the defaults apply.
create table if not exists public.job_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  daily_batch_size smallint not null default 10 check (daily_batch_size between 1 and 100),
  queue_max_age_days smallint not null default 21 check (queue_max_age_days between 1 and 365),
  updated_at timestamptz not null default now()
);

drop trigger if exists job_settings_set_updated_at on public.job_settings;
create trigger job_settings_set_updated_at
before update on public.job_settings
for each row
execute function public.set_updated_at();

alter table public.job_settings enable row level security;

drop policy if exists "Users can select their own settings" on public.job_settings;
create policy "Users can select their own settings"
on public.job_settings
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own settings" on public.job_settings;
create policy "Users can insert their own settings"
on public.job_settings
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own settings" on public.job_settings;
create policy "Users can update their own settings"
on public.job_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on public.job_settings to authenticated;

-- Not exposed through the API: only the functions below (and pg_cron) call into it.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.batch_size(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.daily_batch_size from public.job_settings s where s.user_id = p_user), 10)::integer;
$$;

create or replace function private.max_age_days(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.queue_max_age_days from public.job_settings s where s.user_id = p_user), 21)::integer;
$$;

-- The one place that promotes: best match_score first, oldest first on ties, from the whole queue.
-- Rows older than queue_max_age_days are never promoted (postings close); the daily run archives them.
-- date_found becomes the day it surfaced (Eastern time); created_at keeps the day it was discovered.
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

-- Daily run (pg_cron): for each user with a queue, archive stale queued rows, then promote one batch.
create or replace function private.promote_daily_batches()
returns table (owner_id uuid, stale_archived integer, promoted integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  queue_owner uuid;
begin
  for queue_owner in
    select distinct j.user_id from public.jobs j where j.status = 'Queued' and not j.archived
  loop
    update public.jobs j
    set archived = true
    where j.user_id = queue_owner
      and j.status = 'Queued'
      and not j.archived
      and j.created_at < now() - make_interval(days => private.max_age_days(queue_owner));
    get diagnostics stale_archived = row_count;
    owner_id := queue_owner;
    promoted := private.promote_queued(queue_owner, private.batch_size(queue_owner));
    return next;
  end loop;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;

-- "Next batch" button. Scoped by auth.uid(), never by a parameter, so a user can only promote their own rows.
create or replace function public.promote_next_batch(n integer default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in to load the next batch.' using errcode = '42501';
  end if;
  if n is not null and (n < 1 or n > 100) then
    raise exception 'n must be between 1 and 100.' using errcode = '22023';
  end if;
  return private.promote_queued(uid, coalesce(n, private.batch_size(uid)));
end;
$$;

revoke all on function public.promote_next_batch(integer) from public, anon;
grant execute on function public.promote_next_batch(integer) to authenticated;

-- 11:00 UTC, an hour after the discovery workflow (10:00 UTC). Re-running this migration updates the job.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('promote-daily-job-batch', '0 11 * * *', 'select private.promote_daily_batches()');
