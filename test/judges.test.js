import test from 'node:test'
import assert from 'node:assert/strict'
import { grade } from '../lib/pipeline/judges/registry.js'
import { codeGraders } from '../lib/pipeline/judges/code.js'
import { ruleGraders } from '../lib/pipeline/judges/rule.js'

test('rule schema_valid fails on missing required field', async () => {
  const r = await ruleGraders.schema_valid({ artifact: { name: 'x', schema: { required: ['id'] } } })
  assert.equal(r.result, 'fail')
})

test('rule schema_valid passes a valid artifact', async () => {
  const r = await ruleGraders.schema_valid({ artifact: { id: 1, name: 'x', schema: { required: ['id'] } } })
  assert.equal(r.result, 'pass')
})

test('code verify_read_back returns review when tool not wired', async () => {
  const r = await codeGraders.verify_read_back({ artifact: { id: '1' }, ctx: {} })
  assert.equal(r.result, 'review')
})

test('code verify_read_back passes when readObject returns an object', async () => {
  const ctx = { tools: { readObject: async () => ({ id: '1' }) } }
  const r = await codeGraders.verify_read_back({ artifact: { entity: 'obj', id: '1' }, ctx })
  assert.equal(r.result, 'pass')
})

test('grade() rejects unknown artifact types', async () => {
  await assert.rejects(() => grade('nope', {}), /unknown artifact type/)
})

test('grade() returns a structured verdict with checks', async () => {
  const ctx = { tools: { readObject: async () => ({ id: '1' }) } }
  const out = await grade('created_object', { entity: 'obj', id: '1', schema: { required: ['id'] } }, ctx)
  assert.ok(['pass', 'fail', 'review'].includes(out.verdict))
  assert.ok(Array.isArray(out.checks))
  assert.equal(out.checks.length, 2)
  assert.equal(out.verdict, 'pass')
})
