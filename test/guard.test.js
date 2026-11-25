import test from 'node:test'
import assert from 'node:assert/strict'
import { requireSafeId, isIrreversible, runGuarded, assessImpact } from '../lib/pipeline/guard.js'

test('requireSafeId accepts valid ids', () => {
  assert.equal(requireSafeId('Contractor_123'), 'Contractor_123')
  assert.equal(requireSafeId('x'), 'x')
})

test('requireSafeId rejects invalid ids', () => {
  assert.throws(() => requireSafeId('bad id'), /invalid identifier/)
  assert.throws(() => requireSafeId('../x'), /invalid identifier/)
  assert.throws(() => requireSafeId(''), /invalid identifier/)
})

test('isIrreversible flags delete/publish/mass_update', () => {
  assert.equal(isIrreversible('delete'), true)
  assert.equal(isIrreversible('read'), false)
})

test('runGuarded fails closed without authorize', async () => {
  const r = await runGuarded({ execute: async () => 'done', input: {} })
  assert.equal(r.ok, false)
  assert.equal(r.status, 'blocked')
})

test('runGuarded fails closed without confirmation', async () => {
  const r = await runGuarded({ authorize: async () => ({ allowed: true }), execute: async () => 'done', input: {} })
  assert.equal(r.ok, false)
  assert.equal(r.status, 'unconfirmed')
})

test('runGuarded blocks when authorize denies', async () => {
  const r = await runGuarded({
    authorize: async () => ({ allowed: false, reason: 'no perm' }),
    confirm: async () => true,
    execute: async () => 'x',
    input: {},
  })
  assert.equal(r.ok, false)
  assert.equal(r.status, 'blocked')
  assert.equal(r.reason, 'no perm')
})

test('runGuarded executes when authorized and confirmed', async () => {
  const r = await runGuarded({
    authorize: async () => ({ allowed: true }),
    confirm: async () => true,
    execute: async (i) => `done:${i.x}`,
    input: { x: 1 },
  })
  assert.equal(r.ok, true)
  assert.equal(r.status, 'executed')
  assert.equal(r.result, 'done:1')
})

test('assessImpact blocks delete with downstream references', async () => {
  const r = await assessImpact({ enumerateDownstream: async () => ['obj1', 'obj2'], id: 'x', operation: 'delete' })
  assert.equal(r.checked, true)
  assert.equal(r.blocking, true)
  assert.equal(r.references.length, 2)
})

test('assessImpact allows update with references', async () => {
  const r = await assessImpact({ enumerateDownstream: async () => ['obj1'], id: 'x', operation: 'update' })
  assert.equal(r.checked, true)
  assert.equal(r.blocking, false)
})

test('assessImpact is unchecked without an enumerator', async () => {
  const r = await assessImpact({ id: 'x', operation: 'delete' })
  assert.equal(r.checked, false)
  assert.equal(r.blocking, false)
})
