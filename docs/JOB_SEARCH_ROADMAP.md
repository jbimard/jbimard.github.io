# Job Search Automation Roadmap

**Goal:** a full-time role (or a strong internship) starting around May 2027, in cloud security, cloud or security engineering.

**Locations:** Charlotte and the Triangle first, then Boston and NYC, then remote US.

**How the work is split:** discovery is fully automated, Claude prepares each application, and every submission is supervised by a person.

Work through the steps in order. Update the status column as each step lands, and add new decisions to the log at the bottom instead of reopening them.

| # | Step | Status |
|---|------|--------|
| 1 | Ship daily discovery | Done — PR #6 merged, secrets set, 1-job test inserted OK. Workflow re-enabled at the end of 1b |
| 2a | Real H-1B sponsor data (USCIS) | Done — PR #8; USCIS FY2024–FY2026 (Q3) data in `automation/data/h1b-sponsors.json` |
| 1b | Daily batch of 10 + "Next batch" button | Done — PR #9, deployed 2026-10-16; `Queued` status, 11:00 UTC batch via `pg_cron`, "Next batch" button; migration + intake deployed and **workflow re-enabled** |
| 3a | Claude screening + review queue | Done — `job-screening` function, routine instructions in `automation/screening/ROUTINE.md`, Review tab in `/jobs`. Live once the function is deployed and the routine is created (`docs/JOBS_SETUP.md` §11) |
| 1c | Closed-posting check: archive jobs whose posting is gone | Live — PR #14; deployed and secrets set 2026-10-16; workflow dry run checked 71 postings (67 open, 4 couldn't verify) |
| 3b | Preparation: cover letter, application answers, ATS-optimized resume, private storage | Live — PR #15; deployed, base file uploaded, routine "Job preparation" daily at 14:00 UTC in its own environment (first run 2026-10-16: OK, 0 jobs) |
| 3c-A | Resume check, preview, ATS score, Approve / Regenerate | Done — PR #16; deployed and the inventory uploaded 2026-10-16. Confirm on the next preparation run that new packets carry no "no inventory" flag |
| 3c-B | Edit packets in the dashboard, re-render, read-aloud pass, voice memory | Done — **B1** PR #19 (plus #20–#22); **B2** voice memory PR #26, deployed 2026-10-16: pull returns his last 40 edits, `ROUTINE.md` follows them |
| 3c-ATS | ATS gaps from the 2026-10-16 check: per-qualification Fit & Gap, Certifications section, PDF copies | Done — with B1 (PR #19); graduation-window fit and ATS from posting text in #22–#23; `inventory.not_yet` gap list in #24. First full test (Marvell): ATS 59 → 77 after the base gained AWS, MySQL, Java and GitHub Actions; packet approved 2026-10-16 |
| 2b | More local companies (new board adapters) | Done — 8 companies on existing boards (#28); iCIMS + Jibe for SAS and First Citizens (#29); SuccessFactors for Duke and Novo Nordisk (#30). Phenom / Avature / Eightfold left for later |
| 2c | More Charlotte companies | Done — 12 companies on existing adapters (#31); Oracle + Radancy + SuccessFactors entries for Honeywell, Charter, Nucor, Brighthouse (#32); Eightfold adapter for Microsoft, with a PERM-suspension warning (#33) |
| 4 | Visa timeline card | Done — #34: `visa_profile` table, "My timeline" card, rules-to-watch list with the OPT fee proposal. Migration pushed 2026-10-16 |
| 5 | Supervised applying | Built — this PR: Apply box in the packet panel (instructions for Claude in Chrome, Open posting, Mark applied with a follow-up a week out). First supervised run still to do |

Order: **1 → 2a → 1b → 3a → 1c → 3b → 3c-A → 3c-B1 + 3c-ATS → 3c-B2 → 2b → 2c → 4 → 5.** Next: **the first supervised application**, then use the pipeline daily.

- 2a is small and gives step 3 real sponsorship data from day one.
- 1b comes before the workflow is turned back on, so the dashboard never gets flooded with the whole backlog.
- 1c is small and stops review time going to postings that have already closed, before 3b spends effort tailoring for them.
- Step 3 removes the daily bottleneck: reading, tailoring and answering by hand.
- October–November is peak season for 2027 new-grad openings, so don't let 2b or polish delay step 3.

---

## 1. Ship daily discovery

The work: `automation/` (the script), `.github/workflows/discover-jobs.yml` (the daily run), and section 10 of `docs/JOBS_SETUP.md` (setup).

1. Commit, open a PR, merge.
2. Add the `JOB_INTAKE_URL` and `JOB_INTAKE_TOKEN` repository secrets in GitHub (Settings → Secrets and variables → Actions). Never paste them into chat.
3. Go to Actions → Daily job discovery → Run workflow (not dry run). About 50 jobs should land in `/jobs` as `Found`. A second run should insert 0.
4. Review them for a few days: archive the wrong ones and note any patterns. Use that to tune `automation/config/profile.json`.

## 1b. Daily batch of 10 + "Next batch" button (done)

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

## 1c. Closed-posting check (done)

**Problem:** jobs wait in the queue, in Review, and in `Ready to Apply` for days or weeks, and postings close in the meantime. The 21-day stale rule (1b) is only a guess. A closed job shown again wastes review time, and 3b would waste effort tailoring for it.

**Goal:** check every open job's posting each day, and quietly archive the ones that are gone, before they reach the dashboard.

**Recommended approach** (confirm in planning):

- **Which rows are checked:** `Queued`, `Found`, `Fit Check` and `Ready to Apply`, not archived. Jobs already `Applied` or later are never archived. A closed posting there gets a note instead, since postings often close after the applicant pool is full.
- **How each one is checked,** cheapest and most reliable first. These are all official public APIs, the same ones discovery already uses:
  - **Board sources (Greenhouse, Lever, Ashby, Workday):** discovery already downloads each company's full list of open postings every morning. A job from that board that's no longer in the list is closed. No extra requests, and it only counts when that board's fetch succeeded, so an outage never closes anything.
  - **Single-posting lookups** for jobs whose board wasn't in today's fetch: Greenhouse `boards-api.greenhouse.io/v1/boards/{board}/jobs/{id}` and Lever `api.lever.co/v0/postings/{company}/{id}` return 404 once a posting closes. Ashby and Workday have similar per-posting endpoints. Verify them in planning.
  - **Simplify jobs:** Simplify's listing turns `active: false` when the role closes, and discovery already reads those lists.
  - **Other career sites:** an HTTP 404 or 410 counts as closed. Anything unclear, like a redirect to a generic careers page or a timeout, is left alone and labeled "couldn't verify". It never auto-closes on a guess.
- **Two strikes:** a job is closed only after **two checks in a row**, on different days, say it's gone. This avoids archiving on a one-off glitch. New columns: `link_checked_at`, `link_missing_count`, `link_status` (`open` / `missing` / `unverified`).
- **What closing does:**
  - status becomes `Closed`, `archived = true`
  - a note in `notes`: "Posting closed (checked 2026-10-20 via greenhouse)"
  - it shows up under the Archived filter, and Unarchive undoes it
- **Where it runs:** as a step in the existing daily discovery workflow, after the fetch. It reads and writes through an Edge Function with its own token, in the same pattern as `job-intake` and `job-screening`, and it uses no AI.
- **Order of the morning:** discovery 10:00 → closed check (same run) → batch promotion 11:00 → screening 11:30. Closed jobs then never get promoted, screened or reviewed.
- **Dashboard:** a small "N closed postings archived today" line. An "Check link" action on a row can wait.
- **Privacy:** CI logs print counts only, as with discovery.
- **Promotion guard:** promotion skips rows with `link_status = 'missing'` (one strike), so a job that's probably closed isn't surfaced while it waits for its second check.

## 2. Make the data more accurate

### 2a. Real H-1B sponsor data (done)

- **Real H-1B sponsor data:** use the **USCIS H-1B Employer Data Hub**, which is free, official, and gives per-company initial approvals.
  - Download the CSVs for the last 2–3 fiscal years and commit a trimmed copy (company → initial approvals per year).
  - Replace the hand-set `sponsorTier` with tiers based on real counts (e.g. 50+ = strong, 5–49 = some, 0 = none on record), and score sponsorship from that.
  - Match company names loosely ("Wells Fargo Bank NA" = "Wells Fargo"), so Simplify jobs at unlisted companies also get a real signal.
  - Show the count in the label, e.g. "USCIS: 212 initial H-1B approvals in FY2025."
  - Refresh once a year (steps in `docs/JOBS_SETUP.md` §10).
### 2b. More local companies (after step 3)

- **More local companies:** the original gap list (Bank of America, Lowe's corporate tech, Honeywell, Duke Energy IT, SAS, Lenovo, MetLife). Now covered: Bank of America and Honeywell (2c), SAS (2b), and Lowe's and Duke Energy, which were already on Workday. Still out: Lenovo, MetLife.
- **Many more Triangle companies (Raleigh, Durham, RTP, Cary, Morrisville), at his request (2026-10-16).** Already covered: Red Hat, Cisco, Fidelity, IQVIA, Labcorp, Epic Games, Pendo and Bandwidth. Candidates to check first, for open cloud and security roles, their ATS and their H-1B record:
  - **Tech:** SAS, IBM (RTP), Lenovo, NetApp, Cloud Software Group (Citrix), Google (Durham), Apple (Raleigh), Wolfspeed, Jaggaer, Brightly, Spreedly, Relias, CommerceHub
  - **Finance and insurance:** First Citizens Bank, MetLife (Cary), UBS (RTP), Truist (Raleigh)
  - **Health, pharma and biotech IT:** GSK, Biogen, Novo Nordisk, Syneos Health, Merck, Duke Health, UNC Health
  - **Industrial with large tech centers:** John Deere (Cary), Siemens Healthineers, Eaton, ABB
  - **Public and universities:** NC State, Duke University, UNC-Chapel Hill. Note that universities are cap-exempt for H-1B, which matters for his visa.

  The list is a starting point, not checked yet. Each company's ATS decides whether it needs a new adapter (Workday, SmartRecruiters, iCIMS, Oracle). Verify each one's careers board before adding it.
- **Checked 2026-10-16 (2b, part 1):**
  - **Added** (boards answer the existing adapters): GSK, Biogen, Merck, Wolfspeed, Syneos Health, Cloud Software Group (Citrix) on Workday; Rithum (formerly CommerceHub) on Greenhouse; Spreedly on Lever. H-1B names set where USCIS spells them differently (GSK Solutions / GlaxoSmithKline, Merck Sharp and Dohme, Citrix Systems). The first dry run returned postings from GSK 11, Merck 16, Wolfspeed 14, Rithum 8, Spreedly 6; Syneos and Cloud Software Group had none in his lanes that day. Biogen's `wd3` host didn't resolve from the local machine; confirm on the next GitHub Actions run.
  - **Need a new adapter:** Avature — MetLife; Eightfold — NetApp; Phenom — Siemens Healthineers, ABB.
  - **Their own systems (skip or Simplify only):** IBM, Google, Apple, UBS.
  - **Not found yet:** Lenovo (Workday tenant exists, site name unknown), Eli Lilly (Workday search refuses requests), Eaton, John Deere, UNC Health, Jaggaer, Relias, Brightly, NC State and UNC-Chapel Hill (PeopleAdmin).
- **2b, part 2 (2026-10-16): iCIMS and Jibe adapters.** SAS runs classic iCIMS: `sources/icims.ts` reads the search pages and each posting's schema.org JobPosting block (no public JSON API). First Citizens Bank moved to Jibe (Google's career-site product on top of iCIMS): `sources/jibe.ts` uses its JSON search, which includes descriptions. Both reuse the Workday search terms and page cap. First dry run: SAS 15 postings with descriptions, First Citizens 80, and its 2027 IT Summer Intern (Raleigh) was selected. H-1B names: SAS Institute Inc (a bare "SAS" matched a different employer), First Citizens Bank and Trust Co.
- **2b, part 3 (2026-10-16): SuccessFactors adapter.** `sources/successfactors.ts` reads Career Site Builder search tables and posting pages (the `jobdescription` span). Search is full text, so titles are filtered before posting pages are fetched. Added Duke University (careers.duke.edu, which also lists Duke Health jobs; cap-exempt for H-1B; USCIS lists ~109 filings in FY2024 under "Duke University-Univ-Med Ctr-Affil") and Novo Nordisk (careers.novonordisk.com). First dry run: Duke 1 posting in his title lanes (its IT roles are titled "Consultant, IT" and similar; no cyber titles open), Novo Nordisk 12. Biogen worked from the same run (3 postings).
  - **Left for later:** Phenom (Siemens Healthineers, ABB), Avature (MetLife), Eightfold (NetApp). Each is one or two companies; the Charlotte list (2c) comes first.
- **Optional, later:** salary data from the free DOL LCA disclosure files, to see what each company pays at entry level (the H-1B lottery favors higher wages).

### 2c. More Charlotte companies (done 2026-10-16)

Added at his request after 2b. Already covered before: Wells Fargo, Truist, TIAA, Duke Energy, Lowe's, LendingTree.

- **Added** (all on existing adapters): Bank of America (Workday `ghr/lateral-us`; strong H-1B record, ~70 a year), Ally, Atrium Health (Advocate Health's Workday; USCIS lists it as The Charlotte Mecklenburg Hospital Authority), Premier Inc, Albemarle, Allstate, Daimler Truck North America, RSM, Huntington Bank, AvidXchange and Red Ventures (Greenhouse), Novant Health (Jibe, like First Citizens). H-1B names set where USCIS spells them differently.
- **First dry run:** every board answered; Bank of America added 3 jobs to the selection (cloud security, IAM, infrastructure platform).
- **Part 2, same day:** two more adapters. `sources/oracle.ts` reads Oracle Recruiting Cloud's Candidate Experience JSON (Honeywell; reusable for other Oracle employers). `sources/radancy.ts` reads Radancy/TalentBrew search results (Charter/Spectrum at jobs.spectrum.com); both Radancy and iCIMS posting pages are read through a shared schema.org JobPosting parser (`sources/jsonld.ts`). Nucor and Brighthouse Financial turned out to be SuccessFactors Career Site Builder sites, so they needed only list entries. First dry run: Honeywell 40 postings in his title lanes, Nucor 11, Charter 6, Brighthouse 0. H-1B: Honeywell International (~34–60 a year), Charter Communications (18 in FY2025), Nucor (~9); Brighthouse has no USCIS record.
- **Microsoft (part 3, same day):** first left out on a report that it can't sponsor anymore; the news (2026-10-08) is a suspension from **PERM** (green card labor certification), not from H-1B, and USCIS still shows 1,394 new H-1B approvals in FY2025, so he chose to add it with a warning. `sources/eightfold.ts` reads Eightfold's search JSON (apply.careers.microsoft.com) after taking the landing page's session cookies; it pages twice as deep as Workday since Eightfold pages hold 10. A new `sponsorNote` in `companies.json` adds the warning to every Microsoft posting's sponsorship notes, Simplify ones included. First dry run: 25 postings, 2 selected (Security Engineer, Security Research intern); TS/SCI roles were blocked as usual. NetApp is also on Eightfold, so it can be added the same way.
- **Left out:** Siemens Energy (its site returns an empty page to scripts), Electrolux and Sonic Automotive (sites didn't answer). Truist and Lowe's are already in through Workday even though their front pages run on Phenom.
- **Skipped:** Movement Mortgage (no roles in his lanes), City of Charlotte.

## 3. Claude screening and preparation

Split into three parts: **3a** screening + review queue (done), **3b** preparation (cover letter, answers, ATS-optimized resume, private storage), **3c** Resume check screen + resume preview and ATS score.

### 3a. Screening + review queue (done)

A scheduled Claude routine runs at 11:30 UTC, after the morning batch. For each new `Found` job, it:

- reads the full posting against the resumes and gives a real match score with a reason, replacing the rule-based guess (the rule score is kept)
- double-checks the sponsorship, citizenship and clearance labels, including the USCIS employer match (it can correct a missed or wrong match)
- picks a resume version (Cloud / Security / Cloud Security)
- recommends **Apply / Maybe / Skip** and moves the job to `Fit Check`

The **Review** tab in `/jobs` shows the day's screened jobs. Approve moves a job to `Ready to Apply`, which is where 3b starts. Reject archives it.

### 3b. Preparation (done)

For each approved (`Ready to Apply`) job: draft a cover letter and answers to the standard application questions, and tailor the ATS-optimized resume below.

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

### 3c-B. Editing, re-render, read-aloud, voice memory (in progress)

Two PRs. **B1** makes packets editable; **B2** feeds the edits back into tailoring.

**B1: edit, re-render, read-aloud**
- **Edit tab** in the Packet panel. Change the wording of any bullet, the summary, each cover-letter paragraph and each answer, and remove or reorder bullets within an entry. Everything else stays locked: titles, employers, dates, which base bullet a line rewords, skills, coursework, the match report and the work-authorization answers. Adding bullets or entries is still Regenerate's job.
- **Same truth check:** the `packet-edit` Edge Function (signed in as the owner, no shared token) merges the edit (`automation/prep/edit.ts`), then runs `validatePacket` and `checkPacket`. Any error or red flag refuses the save, and nothing changes.
- **Re-render:** both .docx files are rendered again into `{user}/{job}/r{revision}/`, under the same file names. The row update is guarded by the revision the dashboard opened, and the old files are removed only after it succeeds. So the preview is always the exact stored file.
- **Approval resets** on every saved edit. Ticked yellow flags carry over only if they're about the same text.
- **Read-aloud pass:**
  - **Rules:** new yellow rules in `check.ts`, which the routine sees too: a sentence over 35 words; keyword repeats (2 in a bullet or the summary, 3 in prose); two spelled-out acronyms in one line, or one acronym spelled out in several places; "Responsible for…" openings; passive voice in bullets.
  - **Read through:** a mode in the Edit tab that uses the browser's built-in speech: Sounds like me / Edit this line / Repeat / Stop. No AI API calls.
- **Edits are recorded** from B1 on in `packet_edits` (one row per changed line, with the base source for bullets), so B2 starts with real examples.

**B2: voice memory**
- The routine's pull returns his most recent edits as before/after pairs. `ROUTINE.md` tells it to follow those choices (words he cuts, phrasings he prefers) within the same truth rules.
- **Built:** `job-prep` GET returns the newest 40 `packet_edits` rows as `voice`; `client.ts pull` writes them to `/tmp/prep-voice.json`. The routine learns patterns, reuses his wording for the same base bullet, treats removals as a soft signal, follows the newer edit when two disagree, and never carries a company-specific line to another company.
- **Cleanup:** a new packet removes the `r<n>/` files a regenerated packet's edits left behind.

## 4. Visa timeline card (done)

A "My Timeline" card at the top of `/jobs`. The program end date is entered once, and everything else is worked out from it:

- the OPT filing window (90 days before the program end date, to 60 days after)
- the OPT unemployment counter (90 days maximum, 150 including STEM OPT)
- the STEM OPT filing date (up to 90 days before OPT ends; requires an E-Verify employer)
- each March H-1B registration (2027, 2028, 2029)

It stores dates only, in a `visa_profile` table protected by row-level security like `jobs`. **Never store document numbers** (A-number, SEVIS ID, EAD card number). Confirm all dates with the school's DSO, since this is a reminder tool, not legal advice.

**Built (2026-10-16):** the date logic is in `src/pages/jobs/visaTimeline.ts` (tested in `visaTimeline.test.ts`), the card in `VisaTimelineCard.tsx`, setup in `docs/JOBS_SETUP.md` §14. Beyond the plan above:

- **Rules to watch:** a hand-kept list on the card (`watchList`) with each rule's status, what it means for him, a link and the date it was checked. It starts with the OPT fee proposal (status changes on its own once comments close 2026-11-09), the wage-weighted H-1B lottery, and the $100,000 H-1B fee. The OPT fee line also shows on the collapsed card.
- **H-1B registrations** are worked out, not fixed: every March from the program end year while status lasts until April 1 (when petitions are filed). With an estimated STEM OPT end that is four Marches, not three.
- **Unemployment counter:** days from earlier gaps, plus the current gap from "Not working since". It counts today (the safer side of a limit) and shows the date it would run out.

## 5. Supervised applying (built)

Claude in Chrome:

1. opens each approved job
2. fills the form from the prepared answers and uploads the right resume
3. **stops before Submit**, so a person reviews and clicks it

The status then changes to `Applied`, and a `follow_up_date` is set for 7–10 days later.

Work-authorization questions are always answered truthfully, never with whatever gets past the filter.

**Built (2026-10-16):** the instructions are built from the approved packet (`src/pages/jobs/applyPrompt.ts`, tested) and copied from the packet panel's Apply box; setup and the full rule list are in `docs/JOBS_SETUP.md` §15. Two changes from the plan above:

- **He uploads the files**, not Claude, so the exact approved file is the one sent. Claude says which format the field takes.
- **He signs in and creates accounts.** Claude never types passwords or handles verification codes.

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
  - Search-based boards (Workday and the other search adapters) also search `new grad`, `early career`, `entry level` and `university`, up to 6 pages per term. Their 40-detail cap per company takes early-career, intern and "Graduate" titles first. "Engineer I" / "Software Engineer 1" in a title is an entry-level signal; "Associate" is not, since banks use it as a mid-level title (2026-10-17).
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
- **Daily batch (2026-10-16, step 1b):**
  - Discovery sends every kept job as `Queued`. `/jobs` doesn't load queued rows; it only shows their count on the "Next batch (N waiting)" button.
  - `pg_cron` promotes the best `daily_batch_size` (default 10) at 11:00 UTC, an hour after discovery, ranked by `match_score` from the **whole queue** and oldest first on ties. Internships compete in the same ranking; their own slots still apply when discovery fills the queue.
  - On promotion `date_found` becomes the day the job surfaced (Eastern time); `created_at` keeps the day it was found.
  - Queued rows older than `queue_max_age_days` (default 21) are never promoted and are archived by the daily run.
  - Both paths share one function, `private.promote_queued`. The button calls `public.promote_next_batch()`, a `security definer` function scoped by `auth.uid()` and executable only by signed-in users. It does the same job as the RLS-only approach first planned, and still needs no new token or Edge Function.
  - `job-intake` now reads existing rows in pages of 1000 (the PostgREST `max_rows` limit), so duplicate checks still work once the queue grows past 1000 rows.
- **Screening (2026-10-16, step 3a):**
  - **Claude recommends; he approves.** Screening never moves a job past `Fit Check`. Approve in the Review tab moves it to `Ready to Apply`, and Reject archives it. This replaces "moves strong matches to `Ready to Apply`".
  - The routine runs on the Claude subscription as a scheduled cloud routine at 11:30 UTC, after discovery at 10:00 and the batch at 11:00. Its instructions are versioned in `automation/screening/ROUTINE.md`. The repo still makes no AI API calls.
  - It reads and writes only through the `job-screening` Edge Function, with its own `JOB_SCREENING_TOKEN`, separate from the insert-only intake token. Writes only touch that user's unscreened `Found` rows.
  - Claude's score replaces `match_score`. The rule score is kept in `screening.rule_score` and in `notes`.
  - The sponsorship check uses the USCIS data from 2a. Claude can correct a missed or wrong employer match (`source: "corrected"`) but never guesses one.
  - A clearance requirement is always a Skip (enforced by the validator).
  - The routine never changes the repo.
- **Closed-posting check (2026-10-16, step 1c):**
  - The checker fetches each board's list itself, one request per board, instead of reusing discovery's in-memory lists. Discovery's lists are filtered (Lever non-US, Workday search terms only, Simplify lookback window), so absence from them doesn't prove a posting closed. Cost is about one request per board plus a few confirmations.
  - Signals (verified live in planning):
    - **Greenhouse, Lever:** not in the board list *and* the posting returns 404. A wrong board name also returns 404, so if the list itself doesn't load, the result is "couldn't verify".
    - **Ashby:** no per-posting API, and its posting pages return 200 even for made-up ids, so absence from a board list that loaded is the only signal. Unlisted (`isListed: false`) postings count as open.
    - **Workday:** has no complete list. The posting's 404 counts only if the site's search still answers (a wrong site also returns 404), and `canApply: false` or `posted: false` counts as missing.
    - **Simplify:** `active: false` counts as missing, used only for links that aren't on a supported board.
    - **Other sites:** only 404/410 counts. Redirects aren't followed, and 403, 3xx, 5xx and timeouts count as "couldn't verify".
  - **Two strikes, different UTC days:** a "missing" adds a strike only if the last check was on an earlier day, so re-running the workflow can't close anything. "Couldn't verify" keeps the count, and "open" resets it.
  - **Statuses:** `Queued`, `Found`, `Fit Check` and `Ready to Apply` close (status `Closed`, archived, note). `Applied` and `Follow-Up` get the note once and nothing else. Later stages aren't checked.
  - **Writes** go only through the `job-link-check` Edge Function with its own `JOB_LINK_CHECK_TOKEN`. Each update is guarded by the status it was read with, so a job moved in the dashboard meanwhile is left alone.
  - `private.promote_queued` skips rows with `link_status = 'missing'` (the promotion guard).
  - The check runs as a step in the discovery workflow after discovery, even if discovery failed, and is skipped quietly until its secrets are set.
- **Preparation (2026-10-16, step 3b):**
  - **Source of truth for now: the three base resumes.** They're stored as structured JSON with stable ids in the private bucket (`{user}/base/base-resumes.json`), never in the repo. The experience inventory and full claim tracing remain step 3c.
  - **Claude writes structured content; the function renders.** The routine sends JSON only. `job-prep` validates it and renders the .docx files from one fixed ATS-safe template (single column, standard headings, contact details in the body, no tables, headers or footers). Contact details, titles, employers, dates and education come from the base by id, so Claude can't change them.
  - **Mechanical truth checks** (`automation/prep/packet.ts`, an exact copy of the function's validator):
    - Each bullet names the base bullet it rewords, from the same entry.
    - Numbers and known tools in a bullet must appear in its source; in the summary, cover letter and answers they must appear somewhere in the base. Known tools are a shared tech list, a superset of `profile.json` skills, plus the posting's required skills and the base skills, matched case-sensitively.
    - Skills must already be in the base.
    - Heavy rewording and em dashes are warnings only. Wording inflation like "assisted" → "led" isn't caught mechanically; it's 3c's job.
  - **Work-authorization answers** are fixed text he writes in the base file and are copied verbatim into every packet. They're never AI-written.
  - **No outside research:** company facts in the cover letter and answers come from the posting only.
  - **Files are DOCX only;** PDF and the in-dashboard preview come in 3c. Storage is a private bucket with owner-read-only policies and one-minute signed download links. The `application_packets` table is owner-select-only, and all writes go through the service role.
  - **A separate cloud environment for the routine:** a network secret applies to every request to the Supabase host, so the screening environment would attach the screening token. `job-prep` has its own `JOB_PREP_TOKEN` in its own environment.
  - **Schedule:** daily at 14:00 UTC, after the 11:30 screening and his morning review, plus Run now. One packet per job (`job_id` unique); 3c's Regenerate will replace it.
  - **Internship record (2026-10-16):** the True Homes entry gained the public-safe bullets from his internship record, with three corrections he confirmed: the audit tool covers four Microsoft platforms (not six); "two weeks ahead of schedule" stays; 62 → 4 minutes stays. The record's internal names and audit findings stay out of the base file.
- **Resume check (2026-10-16, step 3c-A):**
  - **Split:** 3c-A is the automatic check, preview, ATS estimate and Approve/Regenerate. 3c-B (next) is editing in the dashboard, re-rendering, the read-aloud pass and voice memory.
  - **Experience inventory** lives in the private base file as `inventory.tools` (each `used` / `built` / `led`, with evidence) and `inventory.certifications` (`earned` / `in_progress`). It's optional in the schema so older uploads keep working; a packet checked without it gets a yellow flag. The draft marks `built` only where a bullet shows building with the tool, and nothing as `led`.
  - **Check rules** (`automation/prep/check.ts`, deterministic, an exact copy in the function):
    - **Red (Blocked):** lead-verb inflation on the assist < build < lead ladder, or leadership words the source lacks; expert-level claims about `used` tools; tools not in the inventory; certifications not earned; locked fields drifting from the base.
    - **Yellow (Needs edits):** buzzwords, vague words, more than 2 em dashes, 3+ bullets with the same opening verb, less than 50% of the source's words kept, leadership words in the letter or answers that no base bullet has, no inventory.
  - **Approval rule (changes the original "only Pass"):** Pass, or Needs edits with every yellow flag acknowledged. Blocked can never be approved; Regenerate deletes the packet so the next run rewrites it. Enforced by `approve_packet` / `regenerate_packet` (security definer, scoped to `auth.uid()`).
  - **The routine never sends a packet with red flags:** `client.ts push` runs the same check and refuses.
  - **Numbers written as words** ("six", "forty-two") are compared like digits; "one" is skipped as a likely pronoun.
  - **ATS estimate:** posting keywords (the shared term list, base skills, required skills), classed required or preferred by section heading. Score = 85 × (2·required covered + preferred covered) / (2·required + preferred) + 15 for format safety. The full base version is scored the same way. With fewer than 3 keywords, no score.
  - **Preview:** the stored .docx rendered in the browser with `docx-preview` (lazy-loaded), so the preview is the exact file.
- **Coursework (2026-10-16, between 3c-A and 3c-B):**
  - Courses from his transcript live in the private base file as `inventory.coursework` (`code`, `title`, `term`, `completed` / `in_progress`, `topics` covered, `tools` used hands-on). There are no grades, and the transcript PDF isn't stored: it has his birth date, and the routine doesn't need either.
  - Hands-on `tools` are only what he confirmed (C, Java OOP, MySQL, MongoDB, sockets). `topics` come from the catalog and syllabi and are never claimed as hands-on use.
  - **Where it can appear:** the cover letter and answers, as coursework, plus a **Relevant Coursework** line under Education: up to 6 course codes per packet (`coursework`), with titles taken from the inventory and "(in progress)" added automatically. Bullets, the summary and skills still have to trace to the base resumes. The ATS estimate counts the coursework line.
  - **Check:** a term only coursework backs is red (`coursework_framing`) unless the text says course/class, and for an in-progress course, that he's taking it now.
- **Sponsor weight (2026-10-16, after 3c-A):** the daily 10 now lean on sponsorship more. This reopens two 2a decisions, at his request.
  - **Why:** he answers "now or in the future require sponsorship?" truthfully (Yes), which automated screens at non-sponsors often reject. So the time is better spent where that answer passes.
  - **Tier points:** strong 25, some 17, rare 10, none on record 5 (were 20 / 15 / 12 / 10). The strong-to-none gap doubles from 10 to 20. A missed name match now costs 5; add the name to `h1bNames` if a known sponsor shows as "none".
  - **"No sponsorship" in the posting:** −30 (was −15). The sponsor component is clamped to −30…25, so the total stays within 0–100.
  - **Effect on the 2026-10-16 dry run (71 jobs):** strong sponsors in the top 10 go from 2 to 5, and no-sponsorship postings from 5 to 0. 51 jobs still clear `minScore` 50.
  - Rows already queued keep their old scores, because intake skips postings it already has. They age out after 21 days (`queue_max_age_days`). New postings use the new weights from the next discovery run.
- **Packet editing (2026-10-16, step 3c-B part 1):**
  - **Red on edit refuses the save** (his choice), the same as the routine, which never sends red packets. A true tool missing from the inventory is fixed by adding it there and re-uploading.
  - **Edit scope:** text, plus removing or reordering bullets (his choice). No new bullets or entries; that stays with Regenerate.
  - **The raw packet is now stored** (`application_packets.packet`), because the edit has to be re-validated against entry and bullet ids. Packets made before this have none and need Regenerate to be editable.
  - **Shared code:** `packet.ts`, `check.ts`, `edit.ts` and `render.ts` live in `supabase/functions/_shared/`, used by `job-prep` and `packet-edit`. The exact-copy tests point there.
  - **Revision folders** (`r2/`, `r3/`…) keep the file names unchanged, so an employer never sees "-r2".
  - **Edits survive Regenerate:** `packet_edits` rows keep their wording when the packet is deleted (`on delete set null`).
- **ATS gaps (2026-10-16, step 3c-ATS, at his request):** a check of open-source ATS tools and of what employers use today.
  - **No open-source tool to adopt.** Employers use proprietary systems (Workday, Greenhouse, Lever, iCIMS, Taleo, SuccessFactors, Ashby), often with licensed parsers. Open-source ATS products (OpenCATS, OrangeHRM, Odoo, Frappe HR) aren't what our targets run. Resume-Matcher imitates an ATS with a language model, which overlaps with our estimate and wouldn't predict real rankings. OpenResume's parser is useful as a manual readability test (PDF only).
  - **Confirmed:** the major ATSs list applicants by date and recruiters search parsed fields by keyword, so keyword findability and clean parsing matter most (our template and estimate). Workday's parser still breaks multi-column and table layouts.
  - **Gap 1, per-qualification grading:** since August 2026, Workday HiredScore grades each basic and preferred qualification with a language model. Basic qualifications decide A/B versus C/D, and recruiters see a Fit & Gap view. Our keyword estimate can't see "2+ years building X", so the routine now writes `qualifications` (met or not, with evidence that must be a bullet in the packet or a section the resume has). The dashboard shows them as Fit & Gap. Optional in the schema for older packets. An edit that removes the only evidence marks the item unmet.
  - **Gap 2, Certifications section:** Workday's parsed profile has a certifications field. Earned inventory certifications now render as their own section, locked like education. From the portfolio, only the Mastercard Cybersecurity Job Simulation (Forage, 2025-01-06) is listed. He left out Python Data Structures (Coursera, 2022) as too old.
  - **Gap 3, PDF copies:** text-based PDFs rendered with `pdf-lib` in standard fonts, in the same order as the .docx. The .docx stays the primary file; the PDF is for PDF-only forms and the OpenResume parser test.
- **Relocation (2026-10-16):** resumes say he's open to relocation. It's an optional `contact.relocation` in the private base file ("Open to relocation"), shown right after the location on the resume and cover-letter contact line, and locked like the rest of the contact details. The routine may also mention it in `anything_else` when the job isn't in his area.
- **One-page resume and style (2026-10-16, after the first real packet):** the Marvell test packet ran two pages, with a first-person summary, a weak lead bullet, Claude Code in four lines and a project that repeated the internship.
  - **One page is red:** `check.ts` estimates the height with Helvetica widths and the renderer's exact word wrap (a Deno test keeps it within one line of the real PDF). `job-prep` and `packet-edit` also measure the real PDF.
  - **New yellow rules:** `first_person`, `weak_lead`, `tool_overuse` (3 or more resume lines) and `duplicate_project`. The summary limit drops from 700 to 360 characters.
  - **Stale preview fixed:** a regenerated packet reuses the same path, so the browser showed the cached old file (the old TA title). Uploads now use `cacheControl: '0'`, and the preview fetches through a fresh signed link with `no-store`.
  - **The .docx font is now Arial** instead of Calibri, which the browser preview didn't have.
- **Graduation fit, posting text, no gap paragraphs (2026-10-16, from the Marvell test):**
  - **Graduation window:** discovery parses the posting's graduation sentence into a date window and compares it with `profile.graduation` ("2027-05"). A mismatch sets level points to 0 and caps the score at `minScore - 1`, so discovery doesn't add it, with a ⚠ note. Screening is told to recommend skip on the same grounds. **Internships that start after May 2027** (Summer 2027 or later) with no stated window are kept at their normal score, at his request: they only get a ⚠ note to check whether they require current enrollment. Before this, "Summer 2027" in an internship title was read as a 2027 graduation match. Jobs already queued keep their scores.
  - **ATS from posting text:** the routine sends `posting_text` when the job has no saved description (Workday imports). The estimate scores against it, and `job-prep` saves it as the job's `job_description`, so edits and regenerations score too. It isn't kept in the stored packet.
  - **No gap paragraphs:** a new yellow rule, `admits_gap`, catches cover letters and answers that volunteer what he lacks. Gaps stay in the match report and Fit & Gap.
- **2c, Charlotte companies (2026-10-16):** a separate step from 2b at his request, done right after it. Only boards the existing adapters can read; new adapters (Oracle for Honeywell, Phenom) wait until a company there is worth it.
- **Microsoft stays in, with a warning (2026-10-16):** the 2026-10-08 suspension covers PERM (green cards) for Microsoft, Adobe, Capgemini, Cognizant, HCL, Infosys, Tata and Wipro, not H-1B or OPT. Its postings carry the note so screening and review see the green-card risk. Revisit if H-1B petitions are restricted too.
- **OPT fee proposal to watch (2026-10-16):** DHS proposed (2026-10-08, docket ICEB-2026-0100) that schools pay $70,000 per student's first OPT and $30,000 per STEM OPT extension. Not in effect; comments close 2026-11-09. He graduates May 2027, so a final rule could land before his OPT. Ask UNC Charlotte ISSS; step 4's timeline card should show its status.
- **Visa timeline card (2026-10-16, step 4):** dates only, owner-only through RLS; no document numbers. Later dates are estimated from the program end date until the EAD dates are entered. Rule statuses checked 2026-10-16: the OPT fee proposal is not in effect (comments close 2026-11-09); the wage-weighted H-1B lottery has been in effect since March 2026; the $100,000 H-1B fee was struck down (2026-06-08), the First Circuit refused to reinstate it (2026-07-24), and it never applied to an F-1 change of status. The watch list is updated by hand when a status changes.
- **Supervised applying (2026-10-16, step 5):** no automation server and no new secrets. The dashboard copies instructions for Claude in Chrome that carry only approved packet text. Claude fills the form and stops before Submit; he signs in, uploads files and submits. Mark applied sets `Applied`, `date_applied` and a follow-up 7 days out (the low end of 7–10, so nothing slips; the row's date can be moved). Questions outside the packet are asked, never guessed, and the employer's pages are treated as data, not instructions.
