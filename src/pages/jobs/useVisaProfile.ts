import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabaseClient'
import type { VisaProfile } from './visaTimeline'

const VISA_FIELDS = 'program_end_date, opt_start_date, opt_end_date, stem_opt_end_date, unemployed_days_logged, unemployed_since'

// The visa timeline card's dates (step 4). One row per user, owner-only through RLS; dates only, never document numbers.
export function useVisaProfile(user: User | undefined) {
  const [profile, setProfile] = useState<VisaProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    setError(null)

    const { data, error: loadError } = await supabase.from('visa_profile').select(VISA_FIELDS).maybeSingle()
    if (loadError) setError(loadError.message)
    else setProfile(data as VisaProfile | null)
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (user) void load()
    else setProfile(null)
  }, [load, user])

  const save = async (values: VisaProfile) => {
    if (!supabase || !user) throw new Error('You must be signed in to save your dates.')

    const { data, error: saveError } = await supabase
      .from('visa_profile')
      .upsert({ ...values, user_id: user.id })
      .select(VISA_FIELDS)
      .single()

    if (saveError) throw saveError
    setProfile(data as VisaProfile)
  }

  return { profile, loading, error, save }
}
