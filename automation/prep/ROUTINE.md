# Job preparation routine

You are preparing application materials for jobs Joseph has already approved in `/jobs` → Review. For each job you write a tailored version of one of his base resumes, a short cover letter, and answers to four standard questions, and send them as structured JSON. The `job-prep` function checks every line against his base resumes, renders the .docx files from a fixed template, and stores them privately. You never apply, never change a job's status, and never write work-authorization answers: those are fixed text he wrote himself.

## Who it's for

- An F-1 international student finishing a BS in CS plus an MS in Cybersecurity (STEM), graduating **May 2027**. Use only the dates in the base resumes.
- Target roles: cloud security, cloud engineering, security engineering, and adjacent roles. New-grad roles and internships.

## The one rule: truthful

Tailoring **rewords and reorders real experience only**. Never invent or inflate a skill, tool, title, date, employer, metric or responsibility. Never hide keywords. A posting keyword he doesn't have goes in `match_report.gaps`, not in the resume.

- The base file's `inventory` lists every tool he can claim, each with a depth: `used`, `built` or `led`. Name only tools in it. Never call him "expert", "advanced" or "proficient" in a tool marked `used`.
- Only certifications with `status: "earned"` may be claimed. An `in_progress` one must say "expected" or "in progress".
- Keep each bullet's lead verb at or below its source's level. "Assisted" or "supported" never becomes "built", and nothing becomes "led", "managed" or "owned" unless the source says so.

The validator and the Resume check enforce this (see "What gets rejected").

## Steps

1. Set up Node, once per run:
   - Run `export NODE_USE_ENV_PROXY=1`. The session reaches the internet only through its proxy; without this, Node's `fetch` fails with "fetch failed". The proxy also adds the API token.
   - Run `node --version`. On Node older than 23.6 (the cloud image has Node 22), add `--experimental-strip-types` after `node` in every command below.
2. Pull: `node automation/prep/client.ts pull --limit=5`
   - It writes the jobs to `/tmp/prep-jobs.json` and the base resumes to `/tmp/prep-base.json`.
   - If it reports 0 jobs, stop.
   - If it returns 409 "No valid base-resumes.json", stop and report that the base file needs to be uploaded.
3. Read `/tmp/prep-base.json`:
   - `versions` holds the three base resumes: `Cloud`, `Security` and `Cloud Security`.
   - Every experience and project entry has an `id`, and every bullet has an `id` like `cloudsec:true-homes-cybersecurity-rotational-intern:3`.
   - The same job can appear in several versions with different wording. You may reword any version's bullet for that same entry id.
4. For each job:
   1. Read `job_description`. If it's short or cut off, open `job_link` for the full posting. Use **only the posting** for facts about the company and role: no outside research, and never state a company fact the posting doesn't.
   2. Start from `resume_version` (screening's pick) unless the posting clearly fits another version better.
   3. **Experience (1–4 entries) and projects (0–3):** pick the most relevant entries by `id`, most relevant first. For each one, choose up to 6 bullets, most relevant first. Each bullet is `{ "from": "<base bullet id>", "text": "<your wording>" }`.
      - Keep his wording where it already fits. Change emphasis and use the posting's exact term where it truthfully describes the same thing. For example, write "AWS IAM" only if the source bullet is about AWS IAM.
      - Keep every number exactly as the source has it.
      - Don't add a tool, platform or skill the source bullet doesn't mention.
   4. **Summary (≤ 700 characters):** a few plain sentences built from the base summaries and bullets, aimed at this role. Add no new numbers or tools.
   5. **Skills (1–5 groups):** use base skill group `id`s with items copied from the base skill lists, reordered so the posting's matches come first. Drop irrelevant items. Don't add any.
   6. **Cover letter (3–5 paragraphs, ≤ 2,500 characters):** no greeting and no sign-off, because the template adds both.
      - Say why this role, using specifics from the posting.
      - Give the one or two most relevant experiences from the base, with their real details.
      - Close briefly.
      - Write like a person: specific and plain. Avoid "leveraged", "spearheaded", "passionate", "results-driven", "dynamic", "cutting-edge", "seamlessly", "robust" and "synergy", and use few em dashes.
   7. **Answers** (each ≤ 1,200 characters, plain first person, specific to the posting):
      - `why_company`: from what the posting says about the company and team
      - `why_role`
      - `relevant_project`: one real project or experience from the base, with its real details
      - `anything_else`: short. For example, his May 2027 graduation and availability. It may be an empty string.
   8. **Match report:**
      - `coverage`: 0–100, your estimate of the share of the posting's required and preferred skills the tailored resume covers
      - `covered`: up to 30 keywords the resume truthfully covers
      - `gaps`: up to 20 items `{ keyword, addable, note }`. `addable: true` only when the base shows the experience but the resume left it out; `false` for real gaps.
5. Write `/tmp/prep-packets.json` as `{ "packets": [ ... ] }`, one object per job:

```json
{
  "job_id": "<id from pull>",
  "resume_version": "Cloud Security",
  "summary": { "text": "…" },
  "experience": [{ "id": "<entry id>", "bullets": [{ "from": "<bullet id>", "text": "…" }] }],
  "projects": [{ "id": "<entry id>", "bullets": [{ "from": "<bullet id>", "text": "…" }] }],
  "skills": [{ "id": "<skill group id>", "items": ["…"] }],
  "cover_letter": { "paragraphs": ["…", "…", "…"] },
  "answers": { "why_company": "…", "why_role": "…", "relevant_project": "…", "anything_else": "" },
  "match_report": { "coverage": 72, "covered": ["…"], "gaps": [{ "keyword": "Kubernetes", "addable": false, "note": "…" }] }
}
```

6. Validate: `node automation/prep/client.ts push /tmp/prep-packets.json --dry-run`.
   - It prints errors, then the **Resume check** for each packet: PASS, NEEDS_EDITS or BLOCKED, with red and yellow flags and the ATS estimate.
   - Fix every error and every **red** flag. A packet with red flags is never sent.
   - Fix yellow flags where you can do it truthfully: buzzwords, vague words, em dashes, bullets that all open with the same verb, heavy rewording. He reviews whatever yellow flags remain before approving.
7. Send: `node automation/prep/client.ts push /tmp/prep-packets.json`. Report the counts it prints: created, invalid, not found, and the check (pass / needs_edits / blocked).

## What gets rejected

- An entry `id` or bullet `from` that isn't in the base, or a bullet taken from a different entry.
- A number in a bullet that its source bullet doesn't have, or a number in the summary, cover letter or answers that the base doesn't have anywhere.
- A known tool, platform or certification named in a bullet that its source bullet doesn't name. The term list is the posting's required skills, the base skills and a common tech list. The same applies to the summary, cover letter and answers, checked against the whole base.
- Skill items that aren't in the base skill lists.
- Missing fields, or text over the limits.
- Numbers written as words count as numbers: "six platforms" against a source that says four is rejected.
- **Resume check, red** (never sent):
  - a lead verb raised above the source's, or "led", "managed" or "owned" added
  - an expert-level claim about a tool the inventory marks `used`
  - a tool not in the inventory
  - a certification that isn't earned
- **Resume check, yellow** (he reviews before approving):
  - buzzwords ("leveraged", "robust", "spearheaded", "passionate", "dynamic", …)
  - vague words ("various", "numerous")
  - more than 2 em dashes
  - 3 or more bullets opening with the same verb
  - a bullet keeping less than half its source's words
  - leadership wording in the cover letter or answers that no base bullet has

## Rules

- **Don't change the repo.** No commits, branches, pushes or pull requests. Write files only under `/tmp`.
- `JOB_PREP_URL` comes from the environment. The token is a **network secret** that the proxy adds for the Supabase host, so the session never has it. If a request returns 401, report that the network secret is missing or wrong, and stop. Never print, ask for, or write any token.
- The base resumes include contact details. Don't repeat them in the run summary.
- Keep the run summary to counts plus one line per job: company, role, resume version, coverage.
