import test from 'node:test'
import assert from 'node:assert/strict'
import { wrapToolResponse, toolError, truncateJson } from '../lib/pipeline/observations.js'

test('wrapToolResponse builds a success envelope', () => {
  const e = wrapToolResponse({ summary: 'created', next_actions: ['verify'], artifacts: ['x.json'] })
  assert.equal(e.status, 'success')
  assert.equal(e.summary, 'created')
  assert.deepEqual(e.next_actions, ['verify'])
  assert.deepEqual(e.artifacts, ['x.json'])
  assert.equal(e.recovery_hint, null)
})

test('wrapToolResponse defaults to error when an error is present', () => {
  const e = wrapToolResponse({ error: new Error('boom') })
  assert.equal(e.status, 'error')
  assert.equal(e.error, 'boom')
})

test('toolError produces an error envelope with a recovery hint', () => {
  const e = toolError('readObject', new Error('404'), { recoveryHint: 'check id' })
  assert.equal(e.status, 'error')
  assert.match(e.summary, /readObject failed/)
  assert.equal(e.recovery_hint, 'check id')
})

test('truncateJson leaves small data intact', () => {
  const data = { a: 1 }
  assert.deepEqual(truncateJson(data, { maxBytes: 100 }), data)
})

test('truncateJson truncates large data and reports original bytes', () => {
  const data = { big: 'x'.repeat(10000) }
  const out = truncateJson(data, { maxBytes: 100, marker: '...' })
  assert.equal(out.truncated, true)
  assert.ok(out.original_bytes > 100)
  assert.ok(String(out.preview).length <= 100)
})
