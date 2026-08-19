import type { Job } from './types'

const value = (input: string | number | null | undefined) => {
  if (input === null || input === undefined || input === '') return 'Not provided'
  return String(input)
}

const selectedJobFields = (job: Job) => `Company: ${value(job.company)}
Role title: ${value(job.role_title)}
Location: ${value(job.location)}
Job link: ${value(job.job_link)}
Status: ${value(job.status)}
Priority: ${value(job.priority)}
Job type: ${value(job.job_type)}
Work mode: ${value(job.work_mode)}
Match score: ${value(job.match_score)}
Required skills: ${value(job.required_skills)}
Sponsorship notes: ${value(job.sponsorship_notes)}
Start date: ${value(job.start_date)}
Graduation requirement: ${value(job.graduation_requirement)}
E-Verify notes: ${value(job.e_verify_notes)}
Cover letter status: ${value(job.cover_letter_status)}
Recruiter contact: ${value(job.recruiter_contact)}
Resume version label: ${value(job.resume_version)}
Notes: ${value(job.notes)}`

export const buildClaudePrompt = (job: Job) => `I want you to help me tailor my application materials for this job.

[insert selected job fields]
${selectedJobFields(job)}

[insert selected job description]
${value(job.job_description)}

[paste master resume]

[paste project bank]

Please identify the strongest resume positioning, the best projects to emphasize, keyword gaps, and any risks or follow-up questions before drafting changes.`

export const buildChatGptPrompt = (job: Job) => `Act as a job-fit reviewer and application strategist.

[insert selected job fields]
${selectedJobFields(job)}

[insert selected job description]
${value(job.job_description)}

[paste master resume]

[paste project bank]

Return a 0-100 fit score, the top evidence for the score, missing keywords or experience, suggested resume bullets, and a concise application plan.`

export const copyToClipboard = async (text: string) => {
  await navigator.clipboard.writeText(text)
}
