import Navbar from '../../components/Navbar'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import AuthPanel from './AuthPanel'
import JobsDashboard from './JobsDashboard'
import { useAuth } from './useAuth'

const Jobs = () => {
  const { session, loading, signIn, signUp, signOut } = useAuth()

  if (!isSupabaseConfigured) {
    return (
      <>
        <Navbar />
        <main className="min-h-[calc(100vh-76px)] bg-slate-100 px-4 py-12">
          <section className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-950">Supabase is not configured</h1>
            <p className="mt-2 text-sm text-slate-600">
              Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local` for local use and to GitHub Actions secrets for deployment.
            </p>
          </section>
        </main>
      </>
    )
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-[calc(100vh-76px)] bg-slate-100 px-4 py-12 text-center text-sm text-slate-500">Checking session...</main>
      </>
    )
  }

  return (
    <>
      <Navbar />
      {session ? <JobsDashboard session={session} signOut={signOut} /> : <AuthPanel signIn={signIn} signUp={signUp} />}
    </>
  )
}

export default Jobs
