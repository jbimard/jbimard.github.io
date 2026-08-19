# Private Job Tracker Setup

The `/jobs` route is intentionally unlisted from the public navigation, but GitHub Pages still serves static files. A direct visit to `/jobs` can load the React app, so privacy comes from Supabase Auth and Row Level Security, not from hiding the URL.

## 1. Required Environment Variables

Create a local `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Fill in only these public Supabase browser values:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

For GitHub Pages deploys, add matching repository secrets in GitHub: Settings -> Secrets and variables -> Actions.

## 2. Create The Database

The schema lives as a Supabase CLI migration at `supabase/migrations/20260819000000_create_jobs_table.sql`. It creates the `jobs` table, check constraints, indexes, an `updated_at` trigger, and RLS policies for select, insert, update, and delete.

Apply it with the Supabase CLI (recommended — this is what the migration file is for):

```bash
supabase login                              # interactive browser login, once per machine
supabase link --project-ref <your-project-ref>   # project ref is in the Supabase dashboard URL
supabase db push                            # applies supabase/migrations/*.sql to the linked project
```

`supabase login` and `supabase link` should be run by you in your own terminal — they're interactive/credentialed steps. Alternatively, you can skip the CLI and paste the migration file's contents into the Supabase dashboard's SQL Editor and run it once; the effect is identical.

The jobs schema uses `role_title` for the role name and `job_link` for the posting URL. It also tracks optional `start_date`, `graduation_requirement`, `e_verify_notes`, `cover_letter_status`, and `recruiter_contact` fields. Valid statuses are Found, Fit Check, Tailoring, Ready to Apply, Applied, Follow-Up, Interview, Offer, Rejected, and Closed. Valid job types are New Grad, Early Career, Rotational Program, Internship, Part-Time, and Other.

## 3. Create Accounts Safely

Because `/jobs` is a public URL, unrestricted email signup lets strangers create accounts in your Supabase project. RLS prevents them from seeing your rows, but they can still occupy project capacity.

Recommended options:

1. Enable email signup only long enough for the two intended accounts to be created, then disable Supabase -> Authentication -> Providers -> Email -> Allow new users to sign up.
2. Keep public signup disabled and create both accounts manually in Supabase -> Authentication -> Users -> Add user.

The app includes a sign-up form so the first option works without code changes.

## 4. Why The Route Itself Is Not Private

GitHub Pages cannot protect a client-side route. The deploy workflow copies `dist/index.html` to `dist/404.html`, which lets direct visits or refreshes on `/jobs` fall back to the React app. That is needed for SPA routing, but it does not authenticate the route at the static host layer.

Signed-out visitors only see the login/sign-up panel. Job rows are fetched from Supabase only after Supabase Auth returns a session.

## 5. What Actually Protects The Data

Supabase Auth identifies each user. The `jobs.user_id` column defaults to `auth.uid()`, and every RLS policy checks `auth.uid() = user_id`. Even if someone edits frontend code in their browser, Supabase rejects reads and writes for rows that do not belong to their authenticated user.

## 6. Never Commit These

Do not commit:

- Supabase service-role key
- Supabase database URL or database password
- AI API keys
- Doppler tokens
- `.env.local` or other real env files
- Resumes, private job data, or application notes

The frontend may ship `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; those are public browser credentials designed to work with RLS.

## 7. Deploy Safely

Before deploying, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as GitHub Actions repository secrets. They can be copied from the Supabase dashboard or from your secrets manager into GitHub. The deploy workflow injects them only during `npm run build`.

Run this local checklist against your own Supabase project:

1. Copy `.env.example` to `.env.local` and fill in your project URL and anon key.
2. Run `supabase db push` (after `supabase login` + `supabase link`), or paste `supabase/migrations/20260819000000_create_jobs_table.sql` into the SQL Editor.
3. Run `npm run dev` and visit `/jobs` while signed out. Confirm only the auth panel renders.
4. Create account A, add a couple of jobs, then test table filtering, sorting, summaries, inline status and priority edits, archive/unarchive, add/edit, copy prompt buttons, and open-link.
5. Create account B and confirm it sees zero jobs from account A.
6. Disable public signup after the intended accounts exist, unless you are manually creating users from Supabase.
7. Add the two Vite env vars as GitHub Actions secrets before pushing to deploy.
