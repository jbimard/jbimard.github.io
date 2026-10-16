-- Step 3b: application packets. The Claude preparation routine (via the job-prep Edge Function) writes one packet per
-- approved job: a tailored resume and cover letter (.docx in a private Storage bucket), drafted answers and a match report.
-- Owners can read their packets; only the function (service role) writes them.

create table if not exists public.application_packets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  resume_version text not null check (resume_version in ('Cloud', 'Security', 'Cloud Security')),
  resume_path text not null,
  cover_letter_path text not null,
  resume_content jsonb not null,
  cover_letter text not null,
  answers jsonb not null,
  work_authorization jsonb not null,
  match_report jsonb not null,
  warnings jsonb not null default '[]'::jsonb,
  -- Step 3c's Resume check sets Pass / Needs edits / Blocked; until then every packet is pending.
  check_status text not null default 'pending' check (check_status in ('pending', 'pass', 'needs_edits', 'blocked')),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists application_packets_user_id_idx on public.application_packets (user_id);

alter table public.application_packets enable row level security;

drop policy if exists "Users can select their own packets" on public.application_packets;
create policy "Users can select their own packets"
on public.application_packets
for select
using (auth.uid() = user_id);

revoke all on public.application_packets from anon, authenticated;
grant select on public.application_packets to authenticated;

-- Private bucket: files are read through short-lived signed URLs, never public links.
-- Paths are {user_id}/{job_id}/<file>.docx and {user_id}/base/base-resumes.json.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-packets',
  'application-packets',
  false,
  5242880,
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/json']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Owners can read (and so sign URLs for) files in their own folder. No client insert, update or delete.
drop policy if exists "Users can read their own packet files" on storage.objects;
create policy "Users can read their own packet files"
on storage.objects
for select
to authenticated
using (bucket_id = 'application-packets' and (storage.foldername(name))[1] = auth.uid()::text);
