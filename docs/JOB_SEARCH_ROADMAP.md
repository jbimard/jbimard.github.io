# Job Search Automation Roadmap

**Goal:** a full-time role (or a strong internship) starting around May 2027, in cloud security, cloud or security engineering.

**Locations:** Charlotte and the Triangle first, then Boston and NYC, then remote US.

**How the work is split:** discovery is fully automated, Claude prepares each application, and every submission is supervised by a person.

Work through the steps in order. Update the status column as each step lands, and add new decisions to the log at the bottom instead of reopening them.

| # | Step | Status |
|---|------|--------|
| 1 | Ship daily discovery | Done — PR #6 merged, secrets set, 1-job test inserted OK. **Workflow paused** until 1b: re-enable with `gh workflow enable discover-jobs.yml` |
| 2a | Real H-1B sponsor data (USCIS) | Done — USCIS FY2024–FY2026 (Q3) data in `automation/data/h1b-sponsors.json`; workflow still paused |
| 1b | Daily batch of 10 + "Next batch" button | Not started — **next**; **finish by re-enabling the workflow** |
| 3 | Claude screening + preparation (incl. ATS-optimized resumes, Resume check, resume preview + ATS score in dashboard), review queue | Not started — after 1b |
| 2b | More local companies (new board adapters) | Not started — after 3 |
| 4 | Visa timeline card | Not started — independent, can slot in anytime |
| 5 | Supervised applying | Not started |

Order: **1 → 2a → 1b → 3 → 2b → 4 → 5.**

- 2a is small and gives step 3 real sponsorship data from day one.
- 1b comes before the workflow is turned back on, so the dashboard never gets flooded with the whole backlog.
- Step 3 removes the daily bottleneck: reading, tailoring and answering by hand.
- October–November is peak season for 2027 new-grad openings, so don't let 2b or polish delay step 3.

---

## 1. Ship daily discovery

The work: `automation/` (the script), `.github/workflows/discover-jobs.yml` (the daily run), and section 10 of `docs/JOBS_SETUP.md` (setup).

1. Commit, open a PR, merge.
2. Add the `JOB_INTAKE_URL` and `JOB_INTAKE_TOKEN` repository secrets in GitHub (Settings → Secrets and variables → Actions). Never paste them into chat.
3. Go to Actions → Daily job discovery → Run workflow (not dry run). About 50 jobs should land in `/jobs` as `Found`. A second run should insert 0.
4. Review them for a few days: archive the wrong ones and note any patterns. Use that to tune `automation/config/profile.json`.

## 1b. Daily batch of 10 + "Next batch" button

**Goal:** each morning `/jobs` shows only the **best 10 new jobs**, not every match. When those are reviewed and more are wanted, a **"Next batch"** button shows the next 10 best.

**Recommended approach** (confirm in planning):

- **Add a `Queued` status.** Discovery still finds and scores everything, but sends all of it as `Queued` instead of `Found`.
  - This needs a migration on the `jobs` status check constraint, plus matching updates to `src/pages/jobs/types.ts` and both intake validation copies.
  - The dashboard hides `Queued` rows by default.
- **One Postgres function**, e.g. `promote_next_batch(n int default 10)`. It moves the caller's top `n` `Queued` rows, by `match_score`, to `Found`.
  - **Daily:** Supabase `pg_cron` calls it for each user after the morning run.
  - **"Next batch" button:** calls it as the signed-in user. Row-level security keeps it scoped to that user's rows, so no new token or Edge Function is needed.
- **Ranking:** the best 10 are chosen from the **whole queue**, not just today's finds. A strong job found yesterday can still beat today's.
- **Daily size:** 10 by default, as a setting rather than hard-coded.
- **Show the queue size** on the button ("Next batch (37 waiting)").
- **Clear out stale rows** automatically, e.g. archive `Queued` rows older than about 21 days, since postings close.
- **After step 3**, Claude re-ranks the queue before each promotion, so the 10 are chosen by real fit, not just the rule score.

## 2. Make the data more accurate

### 2a. Real H-1B sponsor data (done)

- **Real H-1B sponsor data:** use the **USCIS H-1B Employer Data Hub**, which is free, official, and gives per-company initial approvals.
  - Download the CSVs for the last 2–3 fiscal years and commit a trimmed copy (company → initial approvals per year).
  - Replace the hand-set `sponsorTier` with tiers based on real counts (e.g. 50+ = strong, 5–49 = some, 0 = none on record), and score sponsorship from that.
  - Match company names loosely ("Wells Fargo Bank NA" = "Wells Fargo"), so Simplify jobs at unlisted companies also get a real signal.
  - Show the count in the label, e.g. "USCIS: 212 initial H-1B approvals in FY2025."
  - Refresh once a year (steps in `docs/JOBS_SETUP.md` §10).
### 2b. More local companies (after step 3)

- **More local companies:** Bank of America, Lowe's corporate tech, Honeywell, Duke Energy IT, SAS, Lenovo and MetLife aren't reachable through the current boards. Some need a new adapter, such as SmartRecruiters.
- **Optional, later:** salary data from the free DOL LCA disclosure files, to see what each company pays at entry level (the H-1B lottery favors higher wages).

## 3. Claude screening and preparation

A scheduled Claude routine that runs after discovery each morning and, for each new `Found` job:

- reads the full posting against the resume and gives a real match score with a reason, replacing the rule-based guess
- double-checks the sponsorship, citizenship and clearance labels
- picks a resume version (Cloud / Security / Cloud Security)
- drafts a cover letter and answers to the standard application questions
- moves strong matches to `Ready to Apply`

This step also needs a **review queue** view in `/jobs` where the day's batch of 10 (from 1b) gets approved or rejected in about 15 minutes.

### ATS-optimized resume for each application

Most applications are screened by an Applicant Tracking System (Workday, Greenhouse, Lever, iCIMS…), and more and more by AI ranking tools. For each approved job, Claude tailors the chosen base resume so those systems read and rank it well:

- **Match the posting's wording.** Pull the required and preferred skills, tools and titles from the posting. Use the posting's exact terms wherever they truthfully describe the experience. For example, write "AWS IAM" if the posting says that rather than "cloud permissions", and include both the acronym and the spelled-out form ("SIEM (Security Information and Event Management)").
- **Reorder for relevance.** Put the most relevant projects and bullets first, keep a short skills section that mirrors the posting, and keep quantified results.
- **Keep the format ATS-safe:**
  - single column, standard section headings (Experience, Education, Skills, Projects)
  - no tables, text boxes, graphics, or contact info in headers or footers
  - common fonts, saved as `.docx` or a text-based PDF
  - consistent file names
- **Match report** for each job:
  - estimated keyword coverage
  - skills from the posting that are already covered
  - real gaps, and which of those could be honestly added (because the experience exists) versus which are true gaps to mention or skip
- **Strictly truthful.** Never invent skills, titles, dates or experience, and never hide keywords (white text, tiny fonts). That is dishonest, and ATS and AI screeners increasingly detect and penalize it. The tailoring only reorders and rewords real experience.
- **Storage:** tailored resume files stay out of Supabase and out of this public repo. The database only records which tailored version was sent (label plus the match-report summary).
- **Step 5** uploads this tailored file during supervised applying, but only after it passes the Resume check below.

### Resume check screen (truthful and in his own voice)

A review screen that every tailored resume must pass, and that a person must approve, before it can be used. It runs two checks.

**1. Truthfulness: nothing beyond real qualifications**

- **One source of truth:** an **experience inventory**, a private file that he writes and keeps up to date. It lists every job, project, skill, certification, tool, date and metric he can honestly claim. Tailoring may only use facts from it.
- **Every claim is traced:** each bullet, skill and number in the tailored resume is linked back to its line in the inventory. Anything that can't be traced is flagged **red** and blocks approval until it's removed or added to the inventory by him.
- **Specific red flags:**
  - skill levels inflated (e.g. "used" → "expert in", "assisted" → "led")
  - numbers that don't match the inventory
  - titles, dates or employers that changed
  - certifications not yet earned
  - tools from the posting that never appear in the inventory
- **Side-by-side view:** the base resume next to the tailored version, with every change highlighted, so it's quick to see exactly what was reworded.

**2. Authentic voice: reads like him, not like AI**

The aim is not to beat "AI detectors"; those tools are unreliable. The aim is a resume that sounds like a real person, because recruiters notice generic AI phrasing and it hurts credibility.

- **Flag AI-sounding wording:**
  - stock buzzwords: "leveraged", "spearheaded", "seamlessly", "robust", "cutting-edge", "passionate", "results-driven", "dynamic", "synergy", "orchestrated", "pivotal", "in today's fast-paced…"
  - heavy em-dash use
  - every bullet built the same way
  - vague claims with no specifics
- **Stay close to the base resume.** Tailoring changes order, emphasis and keywords, not the whole voice. Bullets rewritten past a set threshold are flagged so he can keep his original wording.
- **Prefer specifics** over adjectives: tools, numbers and outcomes from the inventory.
- **Read-aloud check:** a short "does this sound like you?" pass where he can edit any line, and those edits are kept for future tailoring.

**Result:** each tailored resume gets **Pass / Needs edits / Blocked**. Only **Pass**, plus his approval, makes it available to step 5.

### Resume preview + ATS score in the dashboard

Each job in `/jobs` that has a tailored resume shows a **Resume** panel:

- **Preview** of the exact file that will be submitted. It's the same file step 5 uploads, so what you see is what gets sent.
- **Estimated ATS score (0–100), labeled as an estimate.**
  - Employers' ATS rankings are internal and configured per company; applicants can't see them.
  - Our score combines keyword coverage against the posting (required skills weighted above preferred) with formatting safety (single column, standard headings, parseable file).
  - Shown next to the base resume's score, so the improvement from tailoring is visible.
- **Match report:**
  - keywords covered
  - honest gaps
  - which gaps could truthfully be added from the experience inventory
- **Resume check result:** Pass / Needs edits / Blocked, with the red and yellow flags listed and the side-by-side change view.
- **Actions:** Approve (makes it available to step 5), Edit, or Regenerate.

**Storage (decided 2026-10-16):** tailored resume files live in a **private Supabase Storage bucket**.

- Storage policies restrict each file to its owner (same model as `jobs`: `auth.uid()` must match).
- Files are read through short-lived signed URLs, never public links.
- A table such as `application_packets` links each job to its file path, ATS score, match report, check status and approval.
- The base resumes and the experience inventory may also live in the private bucket. They never go in this public repo.

Storage: resumes live in a private Supabase Storage bucket (see "Resume preview + ATS score" below). Never in this public repo.

## 4. Visa timeline card

A "My Timeline" card at the top of `/jobs`. The program end date is entered once, and everything else is worked out from it:

- the OPT filing window (90 days before the program end date, to 60 days after)
- the OPT unemployment counter (90 days maximum, 150 including STEM OPT)
- the STEM OPT filing date (up to 90 days before OPT ends; requires an E-Verify employer)
- each March H-1B registration (2027, 2028, 2029)

It stores dates only, in a `visa_profile` table protected by row-level security like `jobs`. **Never store document numbers** (A-number, SEVIS ID, EAD card number). Confirm all dates with the school's DSO, since this is a reminder tool, not legal advice.

## 5. Supervised applying

Claude in Chrome:

1. opens each approved job
2. fills the form from the prepared answers and uploads the right resume
3. **stops before Submit**, so a person reviews and clicks it

The status then changes to `Applied`, and a `follow_up_date` is set for 7–10 days later.

Work-authorization questions are always answered truthfully, never with whatever gets past the filter.

---

## Decision log

Settled; don't reopen without a new reason.

- **Filtering:**
  - Only hard block: security clearance (TS/SCI, polygraph, active/current clearance, unconditional clearance wording). Conditional wording ("may require… depending on location") gets a label instead.
  - Kept but penalized and labeled:
    - "Citizenship stated": −20
    - "No sponsorship": −15, and the sponsorship part of the score can go below zero. Getting sponsorship in the first years matters.
  - Internships are kept, with their own slots each run (`maxInternshipsPerRun`).
  - Rotational and early-talent programs count only when they're tech tracks.
- **Scoring:**
  - role 30 + sponsorship 25 + level 15 + location 15 + pay 15
  - title fit scales the non-role points (×1 core / ×0.9 adjacent / ×0.75 generic / ×0.5 off-target)
  - jobs with no level signal get ×0.8 overall
  - high pay only helps on entry-level roles
  - minimum score is 50
- **Pipeline:**
  - Discovery writes only through the existing `job-intake` Edge Function. New rows arrive as `Found`.
  - No AI API calls in the discovery script; Claude work runs as a scheduled routine on the Claude subscription.
- **Sources:**
  - Company boards on Greenhouse, Lever, Ashby and Workday, plus the SimplifyJobs lists.
  - No LinkedIn or Indeed scraping (terms of service).
- **Privacy:** the repo is public, so CI logs print only counts, never company or job names. No visa details or resume text in committed files.
- **Daily volume (2026-10-16):** the dashboard shows the best 10 per day; more come only on request with "Next batch" (step 1b). The workflow stays paused until 1b exists.
- **Resume tailoring (2026-10-16):** each application gets an ATS-optimized version of the chosen base resume (step 3). Tailoring is strictly truthful: rewording and reordering real experience only.
- **Resume storage (2026-10-16):** this replaces the original V1 rule "no resume text in Supabase". The dashboard must preview the exact resume being submitted, so tailored resumes are stored in a private Supabase Storage bucket with owner-only policies. The ATS score shown is our own estimate (keyword coverage + format), labeled as such.
- **Resume check (2026-10-16):** every tailored resume passes a check screen before use. Every claim must trace to his experience inventory, and AI-sounding wording is flagged. The goal is accuracy and his own voice, not evading AI detectors.
- **Order (2026-10-15):** step 2 is split. 2a (USCIS sponsor data) goes before step 3 so screening uses real data; 2b (new board adapters) goes after step 3.
- **H-1B data:** use the USCIS Employer Data Hub, not the Apify "H-1B Visa Salary Search" actor. That actor returns per-filing LCA salary records (not sponsorship counts), costs $0.05 per record, and doesn't clearly state its source.
- **USCIS sponsor data (2026-10-16, step 2a):**
  - The count used is **New Employment approvals** only: first-time H-1B hires, including F-1 → H-1B. Continuation, amended, change-of-employer and concurrent petitions are left out.
  - The tier comes from the latest complete fiscal year: strong 50+ (20 points), some 5–49 (15), rare 1–4 (12), none on record (10). The partial current year is shown as "to date" but never sets the tier. "None" stays at 10, the old `unknown` value, so a missed name match costs nothing extra. The +5 / −15 / −20 adjustments are unchanged.
  - The hand-set `sponsorTier` is removed.
  - Name matching:
    - USCIS names count toward a company when they start with its name and add only generic corporate words (bank, services, holdings, markets, …).
    - A "DBA" name counts as the company name.
    - Names that differ completely go in `h1bNames` in `companies.json`.
  - USCIS blocks scripted downloads (Akamai 403), so the export is downloaded by hand once a year. Only the trimmed JSON (about 2 MB, public data) is committed.
  - Step 2a did not re-enable the workflow; that still happens at the end of 1b.
