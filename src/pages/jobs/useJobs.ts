import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabaseClient'
import type { Job, JobDraft, JobUpdate } from './types'

export function useJobs(user: User | undefined) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadJobs = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    setError(null)

    const { data, error: loadError } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })

    if (loadError) {
      setError(loadError.message)
    } else {
      setJobs((data ?? []) as Job[])
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

  return { jobs, loading, error, reload: loadJobs, createJob, updateJob, archiveJob, deleteJob }
}
