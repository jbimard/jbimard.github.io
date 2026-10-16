# Job Search Automation Roadmap

**Goal:** a full-time role (or a strong internship) starting around May 2027, in cloud security, cloud or security engineering.

**Locations:** Charlotte and the Triangle first, then Boston and NYC, then remote US.

**How the work is split:** discovery is fully automated, Claude prepares each application, and every submission is supervised by a person.

Work through the steps in order. Update the status column as each step lands, and add new decisions to the log at the bottom instead of reopening them.

| # | Step | Status |
|---|------|--------|
| 1 | Ship daily discovery | In progress — PR #6 open; then add secrets + first real run |
| 2 | Make the data more accurate | Not started |
| 3 | Claude screening + preparation, review queue | Not started — **do this before 2** |
| 4 | Visa timeline card | Not started — independent, can slot in anytime |
| 5 | Supervised applying | Not started |

Recommended order: **1 → 3 → 2 (alongside) → 4 → 5.** October–November is peak season for 2027 new-grad openings, so screening (3) matters more than polish.

---

## 1. Ship daily discovery

The work: `automation/` (the script), `.github/workflows/discover-jobs.yml` (the daily run), and section 10 of `docs/JOBS_SETUP.md` (setup).

1. Commit, open a PR, merge.
2. Add the `JOB_INTAKE_URL` and `JOB_INTAKE_TOKEN` repository secrets in GitHub (Settings → Secrets and variables → Actions). Never paste them into chat.
3. Go to Actions → Daily job discovery → Run workflow (not dry run). About 50 jobs should land in `/jobs` as `Found`. A second run should insert 0.
4. Review them for a few days: archive the wrong ones and note any patterns. Use that to tune `automation/config/profile.json`.

## 2. Make the data more accurate

- **Real H-1B sponsor data:** use the **USCIS H-1B Employer Data Hub**, which is free, official, and gives per-company initial approvals.
  - Download the CSVs for the last 2–3 fiscal years and commit a trimmed copy (company → initial approvals per year).
  - Replace the hand-set `sponsorTier` with tiers based on real counts (e.g. 50+ = strong, 5–49 = some, 0 = none on record), and score sponsorship from that.
  - Match company names loosely ("Wells Fargo Bank NA" = "Wells Fargo"), so Simplify jobs at unlisted companies also get a real signal.
  - Show the count in the label, e.g. "USCIS: 212 initial H-1B approvals in FY2025."
  - Refresh once a year.
- **More local companies:** Bank of America, Lowe's corporate tech, Honeywell, Duke Energy IT, SAS, Lenovo and MetLife aren't reachable through the current boards. Some need a new adapter, such as SmartRecruiters.
- **Optional, later:** salary data from the free DOL LCA disclosure files, to see what each company pays at entry level (the H-1B lottery favors higher wages).

## 3. Claude screening and preparation

A scheduled Claude routine that runs after discovery each morning and, for each new `Found` job:

- reads the full posting against the resume and gives a real match score with a reason, replacing the rule-based guess
- double-checks the sponsorship, citizenship and clearance labels
- picks a resume version (Cloud / Security / Cloud Security)
- drafts a cover letter and answers to the standard application questions
- moves strong matches to `Ready to Apply`

This step also needs a **review queue** view in `/jobs` where the day's top jobs get approved or rejected in about 15 minutes.

Constraint: the resume text is never stored in Supabase. The routine reads it from local profile files; the database only records the resume label used.

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
- **H-1B data:** use the USCIS Employer Data Hub, not the Apify "H-1B Visa Salary Search" actor. That actor returns per-filing LCA salary records (not sponsorship counts), costs $0.05 per record, and doesn't clearly state its source.
