import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabaseClient'
import type { ApplicationPacket, Job, JobDraft, JobUpdate } from './types'

const PACKET_FIELDS = 'id, job_id, resume_version, resume_path, cover_letter_path, cover_letter, answers, work_authorization, match_report, warnings, check_status, check_flags, comparisons, ats, checked_at, acknowledged_flags, approved_at, created_at'
const PACKET_BUCKET = 'application-packets'

export function useJobs(user: User | undefined) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queuedCount, setQueuedCount] = useState(0)
  const [packets, setPackets] = useState<Map<string, ApplicationPacket>>(new Map())

  const loadJobs = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    setError(null)

    // Queued rows stay in the database until a batch promotes them; only their count is shown.
    const [{ data, error: loadError }, { count, error: countError }, { data: packetRows, error: packetError }] = await Promise.all([
      supabase
        .from('jobs')
        .select('*')
        .neq('status', 'Queued')
        .order('created_at', { ascending: false }),
      supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Queued')
        .eq('archived', false),
      supabase.from('application_packets').select(PACKET_FIELDS),
    ])

    if (loadError || countError || packetError) {
      setError((loadError ?? countError ?? packetError)!.message)
    } else {
      setJobs((data ?? []) as Job[])
      setQueuedCount(count ?? 0)
      setPackets(new Map(((packetRows ?? []) as ApplicationPacket[]).map((packet) => [packet.job_id, packet])))
    }

    setLoading(false)
  }, [user])

  useEffect(() => {
    if (user) {
      void loadJobs()
    } else {
      setJobs([])
    }
  }, [loadJobs, user])

  const createJob = async (draft: Omit<JobDraft, 'user_id'>) => {
    if (!supabase || !user) throw new Error('You must be signed in to create a job.')

    const { data, error: createError } = await supabase
      .from('jobs')
      .insert({ ...draft, user_id: user.id })
      .select('*')
      .single()

    if (createError) throw createError
    setJobs((current) => [data as Job, ...current])
  }

  const createJobsBulk = async (drafts: Omit<JobDraft, 'user_id'>[]) => {
    if (!supabase || !user) throw new Error('You must be signed in to import jobs.')
    if (drafts.length === 0) return []

    const { data, error: insertError } = await supabase
      .from('jobs')
      .insert(drafts.map((draft) => ({ ...draft, user_id: user.id })))
      .select('*')

    if (insertError) throw insertError
    const inserted = (data ?? []) as Job[]
    setJobs((current) => [...inserted, ...current])
    return inserted
  }

  const updateJob = async (id: string, patch: JobUpdate) => {
    if (!supabase) throw new Error('Supabase is not configured.')

    const { data, error: updateError } = await supabase
      .from('jobs')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) throw updateError
    setJobs((current) => current.map((job) => (job.id === id ? (data as Job) : job)))
  }

  const archiveJob = async (id: string, archived: boolean) => {
    await updateJob(id, { archived })
  }

  const deleteJob = async (id: string) => {
    if (!supabase) throw new Error('Supabase is not configured.')

    const { error: deleteError } = await supabase.from('jobs').delete().eq('id', id)
    if (deleteError) throw deleteError
    setJobs((current) => current.filter((job) => job.id !== id))
  }

  // Moves the best queued jobs (daily_batch_size, default 10) to Found; see promote_next_batch in the migrations.
  const promoteNextBatch = async () => {
    if (!supabase) throw new Error('Supabase is not configured.')

    const { data, error: promoteError } = await supabase.rpc('promote_next_batch')
    if (promoteError) throw promoteError
    await loadJobs()
    return data as number
  }

  // Packet files sit in a private bucket; links are signed for one minute, never public.
  const packetFileUrl = async (path: string) => {
    if (!supabase) throw new Error('Supabase is not configured.')

    const { data, error: signError } = await supabase.storage.from(PACKET_BUCKET).createSignedUrl(path, 60, { download: true })
    if (signError) throw signError
    return data.signedUrl
  }

  // Resume check actions (step 3c); both are owner-scoped database functions.
  const approvePacket = async (packetId: string, acknowledged: string[]) => {
    if (!supabase) throw new Error('Supabase is not configured.')

    const { error: approveError } = await supabase.rpc('approve_packet', { p_packet: packetId, p_acknowledged: acknowledged })
    if (approveError) throw approveError
    await loadJobs()
  }

  const regeneratePacket = async (packetId: string) => {
    if (!supabase) throw new Error('Supabase is not configured.')

    const { error: regenerateError } = await supabase.rpc('regenerate_packet', { p_packet: packetId })
    if (regenerateError) throw regenerateError
    await loadJobs()
  }

  // The stored .docx itself, for the in-browser preview.
  const packetFile = async (path: string) => {
    if (!supabase) throw new Error('Supabase is not configured.')

    const { data, error: downloadError } = await supabase.storage.from(PACKET_BUCKET).download(path)
    if (downloadError) throw downloadError
    return data
  }

  return { jobs, queuedCount, packets, packetFileUrl, packetFile, approvePacket, regeneratePacket, loading, error, reload: loadJobs, promoteNextBatch, createJob, createJobsBulk, updateJob, archiveJob, deleteJob }
}
