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

The jobs schema uses `role_title` for the role name and `job_link` for the posting URL. It also tracks optional `start_date`, `graduation_requirement`, `e_verify_notes`, `cover_letter_status`, and `recruiter_contact` fields. Valid statuses are Queued, Found, Fit Check, Tailoring, Ready to Apply, Applied, Follow-Up, Interview, Offer, Rejected, and Closed. `Queued` rows are hidden in the dashboard until a batch promotes them (section 10). Valid job types are New Grad, Early Career, Rotational Program, Internship, Part-Time, and Other.

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

Required fields are `company` and `role_title`. Use `null` for unknown optional fields. Dates must be `YYYY-MM-DD`. `match_score` must be `null` or a number from 0 to 100. `job_link` must be an `http` or `https` URL when provided. Valid statuses are Queued, Found, Fit Check, Tailoring, Ready to Apply, Applied, Follow-Up, Interview, Offer, Rejected, and Closed. `Queued` rows are hidden in the dashboard until a batch promotes them (section 10). Valid priorities are High, Medium, and Low. Valid job types are New Grad, Early Career, Rotational Program, Internship, Part-Time, and Other. Valid work modes are Remote, Hybrid, Onsite, and Unknown.

Defaults when omitted or blank: `status` is `Fit Check`, `priority` is `Medium`, `work_mode` is `Unknown`, `date_found` is today's date, and `archived` is `false`. The automatic `status` default intentionally differs from Bulk Import's `Found` default so automated finds land in triage.

Warning: never put `service_role` or `JOB_INTAKE_TOKEN` in any frontend file, any committed `.env` file, or anywhere client-visible. This endpoint's entire security boundary is the bearer-token check plus server-only secrets.

Automatic intake only adds new jobs. Everything else, including status changes, edits, archiving, and deleting, stays a dashboard or Bulk Import action.

## 10. Daily Discovery (GitHub Actions)

`automation/discover.ts` finds new postings every morning and sends them to the `job-intake` function above, so section 9 must be deployed first. It uses no AI: it applies fixed filter and scoring rules. Every job it keeps arrives as `Queued`, which `/jobs` doesn't show.

**Daily batch:**

- At **11:00 UTC** (about 7am Eastern, an hour after discovery), `pg_cron` runs `private.promote_daily_batches()`. For each user, it moves the best queued jobs to `Found`: the top 10 by `match_score` from the **whole queue**, so a strong job found yesterday can still beat today's. `date_found` is set to the day the job surfaced.
- To see more, use **Next batch (N waiting)** in the dashboard toolbar. It calls `promote_next_batch()`, which promotes the next batch for the signed-in user only.
- Queued jobs older than 21 days are never promoted, since postings close, and the daily run archives them.
- Settings live in the `job_settings` table (Supabase table editor): `daily_batch_size` (default 10) and `queue_max_age_days` (default 21). No row means the defaults apply.

**Deploying changes to the batch.** Do it in this order, so intake never rejects `Queued` rows:

1. `supabase db push`
2. `supabase functions deploy job-intake`
3. `gh workflow enable discover-jobs.yml`, if the workflow is disabled

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
- **Sponsorship uses real USCIS data.** `automation/data/h1b-sponsors.json` holds each employer's **New Employment** H-1B approvals (first-time H-1B hires, including F-1 → H-1B) from the USCIS H-1B Employer Data Hub. The latest complete fiscal year sets the tier: strong is 50 or more (25 points), some is 5–49 (17), rare is 1–4 (10), and none on record is 0 or no match (5). A posting that says it won't sponsor loses 30, so it ranks below sponsoring employers. Both the thresholds and the points are in `profile.json`. Each row's sponsorship notes include a line like `USCIS: 61 new-employment H-1B approvals in FY2025 (FY2026 to date: 62; FY2024: 118).`
- **Score out of 100:** role 30 + sponsorship 25 + level 15 + location 15 + pay 15. The breakdown is written to each row's `notes`.
  - **Title fit scales everything except role:** security/cloud titles ×1, adjacent titles ×0.9, generic engineering ×0.75, off-target fields such as analytics, data, ML, frontend or mobile ×0.5. A big salary or a strong sponsor can't lift an unrelated role. Tune this with `fitWeights` and `offTargetTitle`.
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
npm run discover -- --limit=1      # send only the top job (connection test)
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
- Company names are matched to USCIS names loosely: "Wells Fargo" also counts "Wells Fargo Bank N A" and "Wells Fargo Securities LLC", and a "DBA" name counts as the company name. If the USCIS name is different, for example Citi → "Citibank", add `"h1bNames": ["Citibank", …]`. To see what a company matches, run a dry run and read its sponsorship notes in `automation/out/report.json`.

**Refresh the H-1B data (once a year, after USCIS adds a full fiscal year, usually around January):**

1. USCIS blocks scripted downloads, so download by hand. Open the [H-1B Employer Data Hub](https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub), select the last two complete fiscal years plus the current one, and download the full employer table as CSV. It arrives as `Employer Information.csv` (UTF-16, tab-separated), which the script reads as-is.
2. Remove the old export from `automation/data/raw/` (it's gitignored) and put the new file there.
3. Run `npm run sponsors:build -- --partial-year=YYYY`, where YYYY is the fiscal year still in progress. Partial years appear as "to date" and are never used for the tier.
4. Run a dry run, check the counts for a few known companies, then commit `automation/data/h1b-sponsors.json`.

Running again never creates duplicates: `job-intake` skips any `job_link` already in the table, including jobs you have archived or rejected.

## 11. Claude Screening (Review Tab)

Each morning a scheduled Claude routine reads the day's `Found` jobs against the resumes. For each one it writes a score, a reason, a recommendation (Apply / Maybe / Skip), checks for sponsorship (including the USCIS employer match), citizenship and clearance, and a resume version. The job then moves to `Fit Check` and appears in **/jobs → Review**. There, **Approve** moves it to `Ready to Apply` and **Reject** archives it. Keyboard: `j`/`k` to move, `a` approve, `r` reject, `l` later. The routine's instructions are in `automation/screening/ROUTINE.md`.

**One-time setup:**

1. Deploy the database change and the function:
   ```bash
   supabase db push
   supabase functions deploy job-screening
   ```
2. Set the function's token yourself, and never paste it into chat or commit it:
   ```bash
   supabase secrets set JOB_SCREENING_TOKEN=$(openssl rand -hex 32)
   ```
   Copy the value into your password manager; the routine needs it. The function also reuses `JOB_INTAKE_USER_ID` from section 9.
3. Create the routine as a scheduled Claude Code cloud agent (`/schedule`) on this repo:
   - **Schedule:** daily at 11:30 UTC, after discovery (10:00) and the morning batch (11:00).
   - **Prompt:** `Follow automation/screening/ROUTINE.md exactly.`
   - **Environment:** a dedicated cloud environment (for example "Job screening"), so the secret and network rules don't apply to your other cloud sessions. In its **Edit cloud environment** dialog:
     - **Environment variables:** `JOB_SCREENING_URL=https://PROJECT_REF.supabase.co/functions/v1/job-screening`. This one isn't a secret.
     - **Network secrets → Add secret:** Secret type **Bearer**. Allowed websites `PROJECT_REF.supabase.co`. Header `Authorization`, prefix `Bearer`, and the value from step 2. Anthropic's proxy adds it to requests for that host, so the session never sees the token, and the host is reachable even with the Trusted network level.
     - **Network access: Custom**, including the defaults, plus the job boards for full postings: `boards-api.greenhouse.io`, `job-boards.greenhouse.io`, `boards.greenhouse.io`, `api.lever.co`, `jobs.lever.co`, `api.ashbyhq.com`, `jobs.ashbyhq.com`, `*.myworkdayjobs.com`. Other career sites stay blocked, and the routine screens those from the stored description.
   - **Don't put the token in Environment variables**: every session in the environment can read them.

**Running it on demand:** after you click **Next batch**, run the routine now from its page to screen the new jobs right away.

**Locally:**

```bash
npm run screening:sponsor -- "Commonwealth Fusion Systems"   # USCIS lookup, no network
JOB_SCREENING_URL=… JOB_SCREENING_TOKEN=… npm run screening:pull -- --out=/tmp/jobs.json
npm run screening:push -- /tmp/results.json --dry-run          # validate only
```

The `job-screening` function updates only that user's `Found` rows that haven't been screened yet, so it can't change jobs you're already working on.

## 12. Closed-Posting Check

Each morning, right after discovery in the same workflow, `automation/links/check.ts` asks each job board whether every open job's posting is still there. It checks `Queued`, `Found`, `Fit Check` and `Ready to Apply`, plus `Applied` and `Follow-Up`. A job is closed only after **two "missing" checks on different days**:

- Before applying: status `Closed`, archived, and a note "Posting closed (checked 2026-10-20 via greenhouse)". It shows under the Archived filter, and Unarchive brings it back.
- After applying: the note only.

One strike keeps a queued job out of the next batch while it waits for its second check. Anything the checker can't confirm (a redirect, a block, a board that doesn't answer) is "couldn't verify" and never closes a job.

How each board is asked (all public APIs, no AI):

| Board | Signal |
|---|---|
| Greenhouse, Lever | Not in the board's job list, and the posting itself returns 404 |
| Ashby | Not in the board's job list (Ashby has no per-posting API) |
| Workday | The posting returns 404 while the site's search still answers, or it says `canApply: false` / `posted: false` |
| Simplify (other sites) | Simplify marks the listing `active: false` |
| Other career sites | HTTP 404 or 410 |

**One-time setup:**

1. Deploy the database change and the function:
   ```bash
   supabase db push
   supabase functions deploy job-link-check
   ```
2. Set the function's token yourself, and never paste it into chat or commit it:
   ```bash
   supabase secrets set JOB_LINK_CHECK_TOKEN=$(openssl rand -hex 32)
   ```
   It reuses `JOB_INTAKE_USER_ID` from section 9.
3. Add two repository secrets (Settings → Secrets and variables → Actions):
   - `JOB_LINK_CHECK_URL` = `https://PROJECT_REF.supabase.co/functions/v1/job-link-check`
   - `JOB_LINK_CHECK_TOKEN` = the value from step 2

Until the secrets exist, the workflow step logs "Link check not configured" and passes. The Actions log and summary show counts only.

**Locally:**

```bash
npm run links:check -- --rows=automation/out/report.json   # check a discovery dry run's links; sends nothing
JOB_LINK_CHECK_URL=… JOB_LINK_CHECK_TOKEN=… npm run links:check -- --dry-run   # real jobs, sends nothing
```

## 13. Application Packets (Preparation)

When you **Approve** a job in Review, it moves to `Ready to Apply`. A second scheduled Claude routine ("Job preparation", daily at 14:00 UTC, or **Run now**) then writes a packet for each approved job without one:
- a tailored resume (.docx)
- a cover letter (.docx, plus the text)
- answers to four standard questions (why this company, why this role, a relevant project, anything else)
- your fixed work-authorization answers
- a match report: estimated coverage, keywords covered, honest gaps

Open it with the **Packet** button on the job's row in `/jobs`. The routine's instructions are in `automation/prep/ROUTINE.md`.

**How truthfulness is enforced:** the routine sends structured text only. The `job-prep` function checks it against your base resumes before rendering anything:
- every bullet must name the base bullet it rewords
- no number or known tool may appear that its source doesn't have
- skills must already be in your skill lists

Contact details, titles, employers, dates and education are copied from the base, never written by Claude. The .docx files come from one fixed ATS-safe template: single column, standard headings, no tables, headers or footers.

**Storage:** everything stays in the private `application-packets` bucket, never in this repo. Files are readable only by you, through one-minute signed download links.

**One-time setup:**

1. Deploy the database change and the function:
   ```bash
   supabase db push
   supabase functions deploy job-prep
   ```
2. Set the function's token yourself, and never paste it into chat or commit it:
   ```bash
   supabase secrets set JOB_PREP_TOKEN=$(openssl rand -hex 32)
   ```
   It reuses `JOB_INTAKE_USER_ID` from section 9.
3. **Review your base resumes:** `automation/private/base-resumes.json`. It's gitignored, and it was extracted from the three PDFs in `public/files/`.
   - Check every entry, date and bullet. Tailoring can only reword what's here.
   - Check the two `workAuthorization` answers. They're copied word for word into every packet. Add more question and answer pairs if you like.
   - Then validate and upload it:
   ```bash
   npm run prep:base -- check
   JOB_PREP_URL=https://PROJECT_REF.supabase.co/functions/v1/job-prep JOB_PREP_TOKEN=… npm run prep:base -- upload
   ```
   Re-upload whenever a base resume changes. The PDFs and this file are separate, so update both.
4. **Create a cloud environment just for this routine** (for example "Job preparation"). It needs its own because a network secret applies to every request to the Supabase host, and the screening environment's secret holds a different token. In **Edit cloud environment**:
   - **Environment variables:** `JOB_PREP_URL=https://PROJECT_REF.supabase.co/functions/v1/job-prep`
   - **Network secrets → Add secret:** type **Bearer**, allowed website `PROJECT_REF.supabase.co`, header `Authorization`, prefix `Bearer`, value = the token from step 2
   - **Network access: Custom**, the same job-board list as screening (§11)
5. Tell Claude the environment exists. The routine is then created daily at 14:00 UTC with the prompt `Follow automation/prep/ROUTINE.md exactly.`

### Resume check (step 3c)

Every packet is checked before it reaches you, with no AI involved (`automation/prep/check.ts`). It gets one of three verdicts:

- **Blocked** (red flags), which can't be approved:
  - a bullet claims more responsibility than its source ("assisted" → "led")
  - "expert in" a tool your inventory marks `used`
  - a tool that isn't in your inventory
  - a certification you haven't earned
  - contact details, titles or dates that differ from your base resumes

  Use **Regenerate**: the packet is deleted and the next preparation run (or Run now) writes a new one. The routine itself never sends a packet with red flags, so this should be rare.
- **Needs edits** (yellow flags only): buzzwords, vague words, many em dashes, repetitive bullet openings, heavy rewording. Tick each flag once you've read it, and **Approve** becomes available.
- **Pass:** **Approve** right away.

**What the Packet panel shows:**
- **Check:** the flags, plus an estimated ATS score for the tailored resume next to the base resume's. The score is our own estimate: posting keywords covered, with required ones counting double, plus format safety. Employers' real ATS rankings aren't visible.
- **Resume:** the stored .docx itself, rendered in the browser.
- **Changes:** each tailored bullet next to the base bullet it rewords, with the changed words highlighted.

Only an **approved** packet will be used for applying (step 5).

**Your experience inventory** is the `inventory` section of `automation/private/base-resumes.json`, and the check treats it as the truth:
- **`tools`:** each with a depth, `used`, `built` or `led`, and the bullet that shows it.
- **`certifications`:** each `earned` or `in_progress`.
- **`coursework`** (optional): courses from your transcript, each `{ code, title, term, status: completed|in_progress, topics, tools }`. `tools` lists only what you used hands-on; `topics` lists what the course covered. Cover letters and answers may cite them, always framed as coursework ("in my Operating Systems course…"), and in-progress courses as current. Each tailored resume may also show up to 6 of them, picked per posting, on a **Relevant Coursework** line under Education. In-progress courses are marked "(in progress)". Resume bullets, the summary and skills can't use them. Leave grades and the transcript itself out.

A draft was built from your resumes and internship record: tools from your skill lists and bullets, `built` only where a bullet shows you building with the tool, no `led`, no certifications. Review it, add any certifications you hold, then re-upload:

```bash
npm run prep:base -- check
JOB_PREP_URL=https://PROJECT_REF.supabase.co/functions/v1/job-prep JOB_PREP_TOKEN=… npm run prep:base -- upload
```

Until the inventory is uploaded, every packet carries one yellow "no inventory" flag.

### Fit & gap, certifications and PDFs

- **Fit & gap** (Check tab): the routine lists each qualification from the posting, basic or preferred, as **Met** (with the resume lines that show it) or **Gap**. This mirrors how Workday HiredScore grades applicants since August 2026: it checks each qualification against the parsed resume, and unmet basic qualifications drop the grade. It's Claude's reading, so check it.
- **Certifications:** every `earned` certification in your inventory is added to a **Certifications** section on each resume, after Skills. The inventory now has the Mastercard Cybersecurity Job Simulation (Forage, Jan 2025). **Re-upload the base file** for this to take effect:
  ```bash
  npm run prep:base -- check
  JOB_PREP_URL=https://PROJECT_REF.supabase.co/functions/v1/job-prep JOB_PREP_TOKEN=… npm run prep:base -- upload
  ```
- **Open to relocation:** the base file's `contact.relocation` ("Open to relocation") is shown right after your location on every resume and cover letter. Remove it from the file to hide it. The same re-upload applies.
- **PDF copies:** each packet also gets a text-based PDF of the resume and the cover letter (**Resume PDF**, **Cover letter PDF**). Same content and order as the .docx, in standard fonts, with no images. Use them on forms that take PDF only.
- **Parser test (optional):** open [open-resume.com/resume-parser](https://www.open-resume.com/resume-parser), which runs in your browser and uploads nothing, and drop in a Resume PDF. Check that your name, contact details, each job's title, company and dates, education and skills come out in the right fields. When you apply in step 5, Workday's and Greenhouse's own autofill is the real version of the same test.

### Packet pending · Run now

An approved job without a packet yet, either newly approved or just regenerated, shows **Packet pending · Run now** on its row. The routine writes the packet at 10:00 AM each day. To get it sooner, click the link: it opens your scheduled routines on claude.ai, then open **Job preparation** and click **Run now**. The dashboard can't start the routine itself, because that needs your claude.ai sign-in, which this public site never holds.

### One page and resume style

- **One page is enforced.** The Resume check estimates the length from the same layout as the PDF and blocks anything longer (red). `job-prep` and `packet-edit` also measure the rendered PDF and refuse a second page. An edit that would push the resume onto page 2 is refused with how many lines to cut.
- **Style flags (yellow):** "I", "my" or "me" in the summary or a bullet; a weak first bullet ("Used…", "Assisted…"); a tool named in three or more resume lines; a project from the same employer as an experience entry.
- **Summary:** at most 360 characters, about 3 lines.
- **Previews are never stale:** packet files are stored with caching off, and the Resume tab fetches a fresh copy. Before this, a regenerated packet could show the previous file.
- **Font:** the .docx uses Arial, which renders the same in Word, in the browser preview and in the PDF's Helvetica metrics.

### Editing a packet (step 3c-B)

The **Edit** tab of the Packet panel lets you change the wording of any bullet, the summary, each cover-letter paragraph and each answer. You can also move bullets up or down, or remove them (**Restore** brings one back). Titles, employers, dates, skills, coursework and your work-authorization answers stay locked. To add bullets or entries, use **Regenerate**.

**Save and re-check** sends the edit to the `packet-edit` function. It runs the same validator and Resume check as the routine:
- **Errors or red flags:** nothing is saved. The lines with problems are outlined in red with the reason. For a true tool that's missing from your inventory, add it to the inventory and re-upload the base file.
- **Otherwise:** the .docx and PDF files are rendered again, so **Resume** previews the new file and the download buttons fetch it. The check result is replaced, and the packet must be **approved again**. Yellow flags you ticked stay ticked if they're about the same text.
- **Every changed line** is kept in `packet_edits` (owner-read-only) as an example of your writing. A later update will feed these to the preparation routine.

**Read aloud** reads the packet one line at a time, using your browser's built-in speech. After each line, pick **Sounds like me** to move on, or **Edit this line** to jump to it. **Listen** next to any line reads just that one. The Resume check also flags lines that are hard to read aloud: run-on sentences, a tool named twice in one line, stacked or repeated acronym spell-outs, "Responsible for…" openings and passive voice.

Packets prepared before this change can't be edited. Regenerate them and the next run writes an editable one.

**One-time setup** (after merging):

```bash
supabase db push
supabase functions deploy packet-edit
supabase functions deploy job-prep   # its shared files moved to supabase/functions/_shared/
```

`packet-edit` needs no secret of its own. It checks your sign-in and only touches your own packets.

**Locally:**

```bash
npm run prep:base -- check                                        # validate the base file, no network
JOB_PREP_URL=… JOB_PREP_TOKEN=… npm run prep:pull                 # → /tmp/prep-jobs.json, /tmp/prep-base.json
npm run prep:push -- /tmp/prep-packets.json --dry-run             # validate packets, nothing sent
```

## 14. Visa Timeline Card

**My timeline** sits at the top of `/jobs`. Enter the program end date from the I-20 once, and the card works out the rest in the browser:

- the OPT filing window (90 days before the program end date to 60 days after)
- the latest OPT end date (14 months after the program end date)
- the STEM OPT filing window (the 90 days before OPT ends; E-Verify employer, I-983 plan)
- each March H-1B registration while status lasts to April 1 of that year
- the OPT unemployment counter (90 days from the EAD start date; STEM OPT adds 60, 150 in total, but STEM OPT needs a job first)

Collapsed, it shows the next date, the unemployment counter and the OPT fee proposal's status. **Show details** lists every date and the rules to watch.

Add the OPT and STEM OPT dates from the EAD cards once they're approved; until then the later dates are marked "estimated". For the unemployment counter, set **Not working since** to the OPT start date before the first job, and clear it while working. When a gap ends, add its days to **Unemployed days from earlier gaps**.

The dates live in `visa_profile`, one row per user, owner-only through RLS like `jobs`. **Dates only:** never enter or store SEVIS IDs, A-numbers, EAD card numbers or receipt numbers. The card is a reminder tool; confirm every date with the school's DSO.

The "Rules to watch" list (`watchList` in `src/pages/jobs/visaTimeline.ts`) is kept up to date by hand. When a rule's status changes, update its wording and `checked` date.

**One-time setup** (after merging):

```bash
supabase db push
```
