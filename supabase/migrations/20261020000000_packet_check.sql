-- Step 3c (part A): the Resume check. job-prep stores a verdict, flags, side-by-side comparisons and an ATS estimate
-- with every packet (automation/prep/check.ts). The owner approves or regenerates a packet through two functions below.

alter table public.application_packets
  add column if not exists check_flags jsonb not null default '[]'::jsonb,
  add column if not exists comparisons jsonb not null default '[]'::jsonb,
  add column if not exists ats jsonb,
  add column if not exists checked_at timestamptz,
  add column if not exists acknowledged_flags jsonb not null default '[]'::jsonb;

-- Approve: a Pass packet directly; a Needs edits packet only when every yellow flag id is acknowledged;
-- never a Blocked or unchecked one. Scoped by auth.uid(), never by a parameter.
create or replace function public.approve_packet(p_packet uuid, p_acknowledged text[] default '{}')
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  packet public.application_packets%rowtype;
  missing text[];
  approved timestamptz;
begin
  if uid is null then
    raise exception 'Sign in to approve a packet.' using errcode = '42501';
  end if;
  select * into packet from public.application_packets p where p.id = p_packet and p.user_id = uid for update;
  if not found then
    raise exception 'Packet not found.' using errcode = 'P0002';
  end if;
  if packet.check_status = 'blocked' then
    raise exception 'A blocked packet cannot be approved; regenerate it.' using errcode = '22023';
  end if;
  if packet.check_status = 'pending' then
    raise exception 'This packet has not been checked yet.' using errcode = '22023';
  end if;
  if packet.check_status = 'needs_edits' then
    select coalesce(array_agg(flag ->> 'id'), '{}') into missing
    from jsonb_array_elements(packet.check_flags) flag
    where flag ->> 'severity' = 'yellow' and not ((flag ->> 'id') = any(coalesce(p_acknowledged, '{}')));
    if cardinality(missing) > 0 then
      raise exception 'Acknowledge every yellow flag first (% left).', cardinality(missing) using errcode = '22023';
    end if;
  end if;
  update public.application_packets p
  set approved_at = now(),
      acknowledged_flags = to_jsonb(coalesce(p_acknowledged, '{}'))
  where p.id = p_packet
  returning p.approved_at into approved;
  return approved;
end;
$$;

-- Regenerate: drop the packet so the next preparation run (the job is still Ready to Apply) writes a new one.
create or replace function public.regenerate_packet(p_packet uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in to regenerate a packet.' using errcode = '42501';
  end if;
  delete from public.application_packets p where p.id = p_packet and p.user_id = uid;
  if not found then
    raise exception 'Packet not found.' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

revoke all on function public.approve_packet(uuid, text[]) from public, anon;
revoke all on function public.regenerate_packet(uuid) from public, anon;
grant execute on function public.approve_packet(uuid, text[]) to authenticated;
grant execute on function public.regenerate_packet(uuid) to authenticated;
