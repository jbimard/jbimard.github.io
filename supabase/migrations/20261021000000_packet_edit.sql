-- Step 3c (part B): editing packets in the dashboard, plus PDF copies of every packet. The packet-edit Edge Function
-- applies an edit, runs the same validator and Resume check as the routine, re-renders the files under new paths and
-- updates the row. Every changed line is kept in packet_edits, which the preparation routine will read as examples of
-- his voice.

alter table public.application_packets
  -- The packet exactly as validated (entry ids, which base bullet each line rewords). Packets from before this
  -- migration have none and can't be edited; Regenerate replaces them.
  add column if not exists packet jsonb,
  add column if not exists revision integer not null default 1,
  add column if not exists edited_at timestamptz,
  -- Text-based PDF copies of the same resume and letter, for forms that take PDF only. Null on older packets.
  add column if not exists resume_pdf_path text,
  add column if not exists cover_letter_pdf_path text;

update storage.buckets
set allowed_mime_types = array[
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
  'application/json'
]
where id = 'application-packets';

-- One row per changed line. Survives Regenerate (packet and job links are cleared, the wording stays).
create table if not exists public.packet_edits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  packet_id uuid references public.application_packets(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  revision integer not null,
  kind text not null check (kind in ('bullet', 'bullet_removed', 'summary', 'cover_letter', 'answer')),
  path text not null,
  -- The base bullet a resume line rewords; null for prose.
  source text,
  before text not null,
  after text,
  created_at timestamptz not null default now()
);

create index if not exists packet_edits_user_created_idx on public.packet_edits (user_id, created_at desc);

alter table public.packet_edits enable row level security;

drop policy if exists "Users can select their own packet edits" on public.packet_edits;
create policy "Users can select their own packet edits"
on public.packet_edits
for select
using (auth.uid() = user_id);

-- Owners read; only the function (service role) writes.
revoke all on public.packet_edits from anon, authenticated;
grant select on public.packet_edits to authenticated;
