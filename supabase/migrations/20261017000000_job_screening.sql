-- Step 3a: the Claude screening routine (via the job-screening Edge Function) scores each new Found job.
-- Screened jobs move to 'Fit Check' and wait in the dashboard's review queue for approve/reject.

alter table public.jobs
  add column if not exists screening jsonb,
  add column if not exists screened_at timestamptz;

-- Waiting for screening (job-screening GET).
create index if not exists jobs_user_id_unscreened_idx
  on public.jobs (user_id, match_score desc nulls last)
  where status = 'Found' and screened_at is null and not archived;

-- Review queue.
create index if not exists jobs_user_id_review_idx
  on public.jobs (user_id, match_score desc nulls last)
  where status = 'Fit Check' and screened_at is not null and not archived;
