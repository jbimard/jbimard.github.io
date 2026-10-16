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
4. Create account A, add a couple of jobs, then test table filtering, sorting, summaries, inline status and priority edits, archive/unarchive, add/edit, Bulk Import, copy prompt buttons, and open-link.
5. Create account B and confirm it sees zero jobs from account A.
6. Disable public signup after the intended accounts exist, unless you are manually creating users from Supabase.
7. Add the two Vite env vars as GitHub Actions secrets before pushing to deploy.

## 8. Bulk Import

Bulk Import is a manual, human-approved intake flow. Nothing auto-imports. Open `/jobs`, click Bulk Import, paste a JSON array of job objects, click Validate, review invalid rows and duplicate warnings, then click Import valid jobs. Valid rows insert through the existing signed-in Supabase session and appear in the table immediately.

Use Copy JSON schema in the dialog to get the current prompt/schema. Example JSON:

```json
[
  {
    "company": "Momentum",
    "role_title": "Software Engineer, New Grad",
    "job_link": "https://example.com/jobs/momentum-software-engineer-new-grad",
    "job_type": "New Grad",
    "location": "Charlotte, NC",
    "work_mode": "Hybrid",
    "start_date": "2027-06-01",
    "graduation_requirement": "Bachelor's degree in Computer Science or related field by Spring 2027.",
    "sponsorship_notes": "No sponsorship mentioned.",
    "e_verify_notes": "E-Verify not mentioned.",
    "required_skills": "TypeScript, React, Node.js, SQL, cloud fundamentals.",
    "match_score": 86,
    "status": "Found",
    "priority": "High",
    "resume_version": "software-engineering-general",
    "cover_letter_status": "Not started",
    "recruiter_contact": null,
    "date_found": "2026-08-19",
    "date_applied": null,
    "follow_up_date": null,
    "job_description": "Build customer-facing web applications with React and backend services.",
    "notes": "Strong match for React, TypeScript, and SQL experience."
  }
]
```

## 9. Automatic Job Intake (Edge Function)

Automatic Job Intake is a fully automatic Edge Function for external scripts or agents. Unlike Bulk Import, it has no human review step and no browser session. It only ever inserts new jobs; it never updates, archives, or deletes existing rows. Those actions stay in the dashboard and human-approved Bulk Import flow.

Deploy the function with:

```bash
supabase functions deploy job-intake
```

The deploy picks up `verify_jwt = false` from `supabase/config.toml` automatically. That is intentional because this function uses its own bearer token instead of Supabase Auth JWT verification.

Set the two custom secrets:

```bash
supabase secrets set JOB_INTAKE_TOKEN=<a-long-random-string> JOB_INTAKE_USER_ID=<your-auth-user-uuid>
```

Find `JOB_INTAKE_USER_ID` in Supabase dashboard -> Authentication -> Users -> copy the UUID of your own account. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already auto-provided to every Edge Function and must not be set manually. Supabase also blocks manually setting `SUPABASE_`-prefixed secret names.

Test with curl:

```bash
curl -X POST "https://PROJECT_REF.supabase.co/functions/v1/job-intake" \
  -H "Authorization: Bearer $JOB_INTAKE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jobs":[{"company":"Momentum","role_title":"2027 Launch Graduate Program: Associate Cybersecurity Analyst","job_link":"https://job-boards.greenhouse.io/momentumcompany3/jobs/8614696002","priority":"High","status":"Fit Check"}]}'
```

For ChatGPT, Codex, or another agent, POST only valid JSON to the endpoint. The endpoint accepts either a raw JSON array or an object shaped like `{ "jobs": [...] }`. Each job object should use only these fields: `company`, `role_title`, `job_link`, `job_type`, `location`, `work_mode`, `start_date`, `graduation_requirement`, `sponsorship_notes`, `e_verify_notes`, `required_skills`, `match_score`, `status`, `priority`, `resume_version`, `cover_letter_status`, `recruiter_contact`, `date_found`, `date_applied`, `follow_up_date`, `job_description`, `notes`.

Required fields are `company` and `role_title`. Use `null` for unknown optional fields. Dates must be `YYYY-MM-DD`. `match_score` must be `null` or a number from 0 to 100. `job_link` must be an `http` or `https` URL when provided. Valid statuses are Found, Fit Check, Tailoring, Ready to Apply, Applied, Follow-Up, Interview, Offer, Rejected, and Closed. Valid priorities are High, Medium, and Low. Valid job types are New Grad, Early Career, Rotational Program, Internship, Part-Time, and Other. Valid work modes are Remote, Hybrid, Onsite, and Unknown.

Defaults when omitted or blank: `status` is `Fit Check`, `priority` is `Medium`, `work_mode` is `Unknown`, `date_found` is today's date, and `archived` is `false`. The automatic `status` default intentionally differs from Bulk Import's `Found` default so automated finds land in triage.

Warning: never put `service_role` or `JOB_INTAKE_TOKEN` in any frontend file, any committed `.env` file, or anywhere client-visible. This endpoint's entire security boundary is the bearer-token check plus server-only secrets.

Automatic intake only adds new jobs. Everything else, including status changes, edits, archiving, and deleting, stays a dashboard or Bulk Import action.

## 10. Daily Discovery (GitHub Actions)

`automation/discover.ts` finds new postings every morning and sends them to the `job-intake` function above, so section 9 must be deployed first. It uses no AI: it applies fixed filter and scoring rules, and the jobs land in `/jobs` with status `Found`, ready for review.

**Where postings come from:**

- Company job boards listed in `automation/config/companies.json` (Greenhouse, Lever, Ashby, and Workday).
- SimplifyJobs' New-Grad and Summer 2027 internship lists. For Simplify jobs on a supported board, the full description is fetched from that board.

**Rules:**

- **Only hard block: security clearance.** This covers TS/SCI, polygraph, "active/current clearance", and other unconditional clearance wording. Conditional wording ("may require… depending on location") is kept and labeled `⚠ Clearance possibly required`.
- **Kept but labeled and penalized:**
  - `⚠ Citizenship stated` (−20 points)
  - `No sponsorship` (−15 points, and the sponsorship part can go below zero; OPT/STEM OPT work authorization still applies, but there's no H-1B path)
- **Rotational and early-talent programs** count only when the title names a tech track (`rotationalTechWords`). For example "Finance Rotational Program" is dropped.
- **Internships** are kept with `job_type: Internship`. They have their own slots each run (`maxInternshipsPerRun`).
- **Dropped as irrelevant:**
  - titles outside the three title groups, and senior titles
  - postings outside the US
  - postings that require more than `maxRequiredYears` of experience
- **Score out of 100:** role 30 + sponsorship 25 + level 15 + location 15 + pay 15. The breakdown is written to each row's `notes`.
  - **Title fit scales everything except role:** security/cloud titles ×1, adjacent titles ×0.9, generic engineering ×0.75, off-target fields such as analytics, data, ML, frontend or mobile ×0.5. A big salary or a known sponsor can't lift an unrelated role. Tune this with `fitWeights` and `offTargetTitle`.
  - **Jobs with no level signal are scaled ×0.8 overall** (`noLevelSignalFactor`). That means no new-grad, intern or graduation-year wording, which usually indicates an experienced hire.
  - Priority: High is 75 or more, Medium is 55–74, Low is anything lower.
  - Only rows scoring at least `minScore` are sent.

**One-time setup.** Add two **repository secrets** under Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `JOB_INTAKE_URL` | `https://PROJECT_REF.supabase.co/functions/v1/job-intake` |
| `JOB_INTAKE_TOKEN` | the same token you set with `supabase secrets set JOB_INTAKE_TOKEN=…` |

The workflow `.github/workflows/discover-jobs.yml` runs daily at 10:00 UTC. To run it by hand, use Actions → Daily job discovery → Run workflow; tick **dry_run** to fetch and score without sending anything. Because this repo is public, its Actions logs are public too. The script prints only counts in CI and never company or job names.

**Running it locally:**

```bash
npm run discover -- --dry-run      # fetch + score, write automation/out/report.json, send nothing
npm run discover:test              # rule unit tests
npm run discover:typecheck
JOB_INTAKE_URL=… JOB_INTAKE_TOKEN=… npm run discover   # real run
```

**Tuning.** Edit `automation/config/profile.json` to change:

- title groups and excluded words
- metro points
- `minScore`, `maxPerRun`, `maxInternshipsPerRun`
- the Simplify lookback window

To add companies to `automation/config/companies.json`:

- For Greenhouse, Lever, or Ashby, `board` is the slug in the board URL.
- For Workday, `board` is `tenant/wdN/site`, taken from a URL like `https://tenant.wdN.myworkdayjobs.com/site`.
- `sponsorTier: "known"` is a hand-kept starting list. Replace it with H-1B employer data later.

Running again never creates duplicates: `job-intake` skips any `job_link` already in the table, including jobs you have archived or rejected.
