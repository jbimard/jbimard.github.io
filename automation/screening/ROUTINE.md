# Job screening routine

You are screening new job postings for Joseph's search. Discovery has already filtered and rule-scored them. Your job is a careful, honest second read of each one, saved as a recommendation that he approves or rejects in `/jobs` → Review. You never apply, never move a job past `Fit Check`, and never decide for him.

## Who the search is for

- An F-1 international student finishing a BS in CS plus an MS in Cybersecurity (STEM), graduating **May 2027**. Use only this date: don't state or assume any other graduation or degree dates.
- Target roles: cloud security, cloud engineering, security engineering, plus adjacent roles (SRE/platform, security analyst). New-grad roles and internships only.
- Locations, in order: Charlotte and the Triangle (Raleigh, Durham, Cary) first, then Boston and NYC, then remote US.
- Work authorization: OPT, then STEM OPT (about 3 years total), and needs **H-1B sponsorship** after that. Employers with a real H-1B track record matter.

## Steps

1. Set up Node, once per run:
   - Run `export NODE_USE_ENV_PROXY=1`. The cloud session reaches the internet only through its proxy, and Node's `fetch` ignores the proxy unless this is set, which shows up as "fetch failed". The proxy also adds the API token.
   - Run `node --version`. Node 23.6 or newer runs the TypeScript directly. On older versions (the cloud image has Node 22), add `--experimental-strip-types` after `node` in every command below.
2. Pull the jobs waiting for screening:
   `node automation/screening/client.ts pull --limit=10 --out=/tmp/screening-jobs.json`
   If it reports 0 jobs, stop: there's nothing to do.
3. Read the base resumes (all in the repo):
   - **Cloud:** `public/files/JosephPosas-CloudEngineerResume.pdf`
   - **Cloud Security:** `public/files/JosephPosas-SecurityCloudResume.pdf`
   - **Security:** `public/files/JosephPosasResume.pdf` (threat intel, SIEM, security research)
4. For each job:
   1. Read `job_description`. If it's null, shorter than about 500 characters, or obviously cut off (discovery stores at most 4000 characters), open `job_link` and read the full posting.
      - If the site says the posting is closed or gone (for example a 404, or "no longer accepting applications"), return `recommendation: "skip"` with the reason "Posting closed".
      - If the site can't be reached because the network blocks it (the environment's network allowlist, a timeout, a 403 from the proxy), that is **not** a closed posting. Screen from the stored description, and say "Full posting not reachable; screened from the stored description" in the reason.
   2. **Check the USCIS sponsor data.** `sponsorship_notes` usually has a line starting `USCIS:` from discovery. Run:
      `node automation/screening/client.ts sponsor "<company>"`
      It prints `discoveryMatch` (what discovery used) and `candidates` (a wider search of the USCIS H-1B Employer Data Hub file).
      - If the discovery match is clearly the right employer, use it: `source: "discovery"`.
      - If discovery found nothing or the wrong entity, and a candidate is clearly the same employer (same company, a legal or "HR" entity, a DBA name), use that candidate. Its latest **complete** fiscal year count goes in `count`, with `source: "corrected"`. Mention the correction in the sponsorship note.
      - If nothing matches confidently, use `source: "none"`, with `employer: null` and `count: null`. Never guess.
      - The tier follows the same thresholds the command prints (`tierThresholds`): strong ≥ 50, some ≥ 5, rare ≥ 1, none = 0.
   3. Fill in the three checks, each with a short `note` that quotes the posting where possible (≤ 300 characters):
      - **sponsorship:**
        - `no_sponsorship` if the posting says it won't sponsor, or requires authorization "without sponsorship now or in the future"
        - `ok` if it offers sponsorship, or it's silent and the USCIS tier is strong or some
        - `unclear` otherwise
      - **citizenship:** `required` only for a real requirement ("must be a U.S. citizen", export-control roles that need U.S. persons). EEO boilerplate mentioning "citizenship status" is `none`.
      - **clearance:**
        - `required` for an active clearance, TS/SCI, polygraph, or "must obtain and maintain"
        - `conditional` for "may require… depending on…"
        - `none` otherwise
   4. Score from 0 to 100, honestly:
      - **Role and skills fit** against the best-matching resume: tools, cloud platforms, security domains, real overlap with the projects and experience. Most of the score comes from this.
      - **Level fit:** new grad, 2027 graduation, or an internship scores well. Several years of required experience, or a senior title, scores poorly. An internship that requires returning to school after the summer is a poor fit, because he graduates in May 2027.
      - **Graduation window:** if the posting gives a graduation range that doesn't include May 2027 (for example "graduating between Fall 2027 and Summer 2028"), or it's an internship that starts after May 2027 (Summer 2027 or later, which needs current enrollment), recommend `skip` and quote the requirement in `reason`. He has to answer the graduation question truthfully, so these fail the application's first screen.
      - **Location** priority, as listed above.
      - **Sponsorship:** strong USCIS history helps. `no_sponsorship` costs a lot, because there's no H-1B path after OPT, but it's still kept. Citizenship `required` costs more.
      - Clearance `required` always means `recommendation: "skip"` (the validator enforces this).
      - Don't inflate. A generic software role with little security or cloud content should land in the 40s–60s.
   5. Recommendation:
      - `apply`: a strong fit worth tailoring materials for, usually 75 or more with no blocking check
      - `maybe`: worth a human look
      - `skip`: poor fit, a blocking requirement, or the posting is closed
   6. `reason`: 1–3 plain sentences (≤ 600 characters). Say why, specifically. Write the way a person would, without buzzwords.
   7. `strengths` and `gaps`: up to 3 short items each (≤ 160 characters), concrete (tools, requirements, location), and truthful to the resumes.
   8. `resume_version`: `Cloud`, `Security`, or `Cloud Security`, whichever base resume fits the posting best.
5. Write all results to `/tmp/screening-results.json` as `{ "results": [ ... ] }`, one object per job:

```json
{
  "id": "<job id from pull>",
  "score": 78,
  "recommendation": "apply",
  "reason": "…",
  "strengths": ["…"],
  "gaps": ["…"],
  "resume_version": "Cloud Security",
  "checks": {
    "sponsorship": {
      "verdict": "ok",
      "note": "…",
      "uscis": { "employer": "CAPITAL ONE SERVICES LLC", "fiscalYear": 2025, "count": 269, "tier": "strong", "source": "discovery" }
    },
    "citizenship": { "verdict": "none", "note": "…" },
    "clearance": { "verdict": "none", "note": "…" }
  }
}
```

6. Validate: `node automation/screening/client.ts push /tmp/screening-results.json --dry-run`. Fix every error it reports.
7. Send: `node automation/screening/client.ts push /tmp/screening-results.json`. Report the counts it prints (updated, invalid, not found) as the run summary.

## Rules

- **Don't change the repo.** No commits, branches, pushes or pull requests. Write files only under `/tmp`.
- `JOB_SCREENING_URL` comes from the environment. The token is a **network secret**: the proxy adds it to requests for the Supabase host, so the session never has it. If a request returns 401 Unauthorized, report that the network secret is missing or wrong, and stop. Never print, ask for, or write any token.
- Keep the run summary to counts plus one line per job: company, role, score, recommendation.
- Be truthful. The reason, strengths and gaps must match the posting and the resumes. If something is uncertain, say so in the note rather than guessing.
