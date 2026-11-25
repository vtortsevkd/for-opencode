import test from 'node:test'
import assert from 'node:assert/strict'
import { dualReview } from '../lib/pipeline/judges/santa.js'

test('dualReview passes when both reviewers approve', async () => {
  const r = await dualReview({
    artifact: 'x',
    reviewA: async () => ({ verdict: 'pass' }),
    reviewB: async () => ({ verdict: 'pass' }),
  })
  assert.equal(r.verdict, 'pass')
  assert.equal(r.rounds, 1)
})

test('dualReview escalates when reviewers never converge', async () => {
  const r = await dualReview({
    artifact: 'x',
    reviewA: async () => ({ verdict: 'fail', reason: 'bad' }),
    reviewB: async () => ({ verdict: 'fail', reason: 'bad' }),
    fix: async (a) => a,
    maxRounds: 2,
  })
  assert.equal(r.verdict, 'escalate')
  assert.equal(r.history.length, 2)
})

test('dualReview fixes and converges on a later round', async () => {
  let calls = 0
  const r = await dualReview({
    artifact: 'x',
    reviewA: async (a) => ({ verdict: a === 'fixed' ? 'pass' : 'fail', reason: 'needs fix' }),
    reviewB: async (a) => ({ verdict: a === 'fixed' ? 'pass' : 'fail', reason: 'needs fix' }),
    fix: async () => {
      calls++
      return 'fixed'
    },
    maxRounds: 3,
  })
  assert.equal(r.verdict, 'pass')
  assert.equal(r.rounds, 2)
  assert.equal(calls, 1)
})

test('dualReview requires both reviewers', async () => {
  await assert.rejects(() => dualReview({ artifact: 'x', reviewA: async () => ({}) }), /required/)
})
