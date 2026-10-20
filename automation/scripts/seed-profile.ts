// Adds or updates one extra user's discovery profile in the user_profiles table.
// Usage: npm run profile:seed -- --email=person@example.com --name="Display name" --file=automation/private/person.profile.json [--disable]
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your shell (service role: run it locally, never in CI or the repo).
// Profile files hold personal job preferences, so keep them in automation/private/ (gitignored).
import { readFile } from 'node:fs/promises'
import { parseProfile } from '../rules/profile.ts'

const arg = (name: string) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null

const main = async () => {
  const email = arg('email')
  const name = arg('name')
  const file = arg('file')
  if (!email || !name || !file) throw new Error('Pass --email=, --name= and --file=.')
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your shell first.')

  // Fails here, not in the next morning's run.
  const profile = parseProfile(JSON.parse(await readFile(file, 'utf8')))
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

  const users = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers })
  if (!users.ok) throw new Error(`Listing users failed: HTTP ${users.status}`)
  const user = ((await users.json()) as { users: Array<{ id: string; email?: string }> }).users
    .find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase())
  if (!user) throw new Error(`No auth user with email ${email}. Create the account first (Supabase → Authentication → Users).`)

  const response = await fetch(`${url}/rest/v1/user_profiles?on_conflict=user_id`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: user.id, display_name: name, enabled: !process.argv.includes('--disable'), profile }),
  })
  if (!response.ok) throw new Error(`Saving the profile failed: HTTP ${response.status} ${await response.text()}`)
  console.log(`Saved profile for ${name} (${user.id}).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
