import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addMonths, milestones, nextMilestone, unemployment, watchList, type VisaProfile } from './visaTimeline.ts'

// A made-up student, not anyone's real dates.
const profile = (patch: Partial<VisaProfile> = {}): VisaProfile => ({
  program_end_date: '2030-05-15',
  opt_start_date: null,
  opt_end_date: null,
  stem_opt_end_date: null,
  unemployed_days_logged: 0,
  unemployed_since: null,
  ...patch,
})

const byKey = (list: ReturnType<typeof milestones>, key: string) => list.find((item) => item.key === key)!

test('addMonths clamps to the end of a shorter month', () => {
  assert.equal(addMonths('2030-01-31', 1), '2030-02-28')
  assert.equal(addMonths('2030-05-15', 14), '2031-07-15')
})

test('OPT filing window runs from 90 days before the program end to 60 days after', () => {
  const opt = byKey(milestones(profile(), '2029-12-01'), 'opt-filing')
  assert.deepEqual([opt.start, opt.end, opt.state], ['2030-02-14', '2030-07-14', 'upcoming'])
  assert.equal(byKey(milestones(profile(), '2030-02-14'), 'opt-filing').state, 'open')
  assert.equal(byKey(milestones(profile(), '2030-07-15'), 'opt-filing').state, 'past')
  assert.equal(byKey(milestones(profile({ opt_start_date: '2030-06-01' }), '2030-03-01'), 'opt-filing').state, 'done')
})

test('STEM OPT window is estimated until the OPT end date is known', () => {
  const estimated = byKey(milestones(profile(), '2029-12-01'), 'stem-filing')
  assert.deepEqual([estimated.start, estimated.end, estimated.estimated], ['2031-02-14', '2031-05-15', true])

  const known = byKey(milestones(profile({ opt_start_date: '2030-06-01', opt_end_date: '2031-05-31' }), '2031-03-10'), 'stem-filing')
  assert.deepEqual([known.start, known.end, known.state, known.estimated], ['2031-03-02', '2031-05-31', 'open', false])
})

test('H-1B registrations run every March while status lasts to April 1', () => {
  const years = (p: VisaProfile) => milestones(p, '2029-12-01').filter((item) => item.key.startsWith('h1b-')).map((item) => item.key)
  // Estimated: OPT to 2031-05-15, STEM OPT to 2033-05-15.
  assert.deepEqual(years(profile()), ['h1b-2030', 'h1b-2031', 'h1b-2032', 'h1b-2033'])
  // STEM OPT ending before April 1 means that March is too late.
  assert.deepEqual(years(profile({ opt_start_date: '2030-06-01', opt_end_date: '2031-05-31', stem_opt_end_date: '2033-03-15' })), ['h1b-2030', 'h1b-2031', 'h1b-2032'])
})

test('next milestone is the open window closing soonest, else the next to open', () => {
  assert.equal(nextMilestone(milestones(profile(), '2029-12-01'))?.key, 'opt-filing')
  assert.equal(nextMilestone(milestones(profile(), '2030-03-10'))?.key, 'h1b-2030')
  assert.equal(nextMilestone(milestones(profile(), '2030-04-01'))?.key, 'opt-filing')
})

test('unemployment clock waits for the OPT start date', () => {
  assert.deepEqual(unemployment(profile({ opt_start_date: '2030-06-01', unemployed_since: '2030-06-01' }), '2030-05-20'),
    { started: false, used: 0, limit: 90, left: 90, runsOut: null })
})

test('unemployment counts today, adds earlier gaps, and runs out on day 90', () => {
  const p = profile({ opt_start_date: '2030-06-01', unemployed_since: '2030-06-01' })
  assert.deepEqual(unemployment(p, '2030-06-01'), { started: true, used: 1, limit: 90, left: 89, runsOut: '2030-08-29' })
  assert.equal(unemployment({ ...p, unemployed_days_logged: 30 }, '2030-06-10').used, 40)
  assert.equal(unemployment({ ...p, unemployed_days_logged: 30 }, '2030-06-10').runsOut, '2030-07-30')
})

test('a gap that started before OPT counts from the OPT start; working stops the clock; STEM raises the limit', () => {
  assert.equal(unemployment(profile({ opt_start_date: '2030-06-01', unemployed_since: '2030-05-01' }), '2030-06-05').used, 5)
  assert.deepEqual(unemployment(profile({ opt_start_date: '2030-06-01', unemployed_days_logged: 12 }), '2030-09-01'),
    { started: true, used: 12, limit: 90, left: 78, runsOut: null })
  assert.equal(unemployment(profile({ opt_start_date: '2030-06-01', stem_opt_end_date: '2033-05-31', unemployed_days_logged: 95 }), '2031-07-01').left, 55)
})

test('OPT fee watch item changes once the comment period closes', () => {
  const fee = (today: string) => watchList(today).find((item) => item.key === 'opt-fee')!.status
  assert.match(fee('2026-11-09'), /comments close 2026-11-09/)
  assert.match(fee('2026-11-10'), /Comments closed/)
})
