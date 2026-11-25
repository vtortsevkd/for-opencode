import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { addInstinct, inject, observe, correct, promote, reflect } from '../lib/pipeline/memory/instincts.js'
import { appendDecision } from '../lib/pipeline/ledger.js'

test('addInstinct adds and dedupes by signal', async () => {
  const memFile = path.join(await mkdtemp(path.join(tmpdir(), 'fis-mem-')), 'instincts.json')
  const opts = { memoryFile: memFile }
  const r1 = await addInstinct({ signal: 's1', rule: 'r1', pattern: 'p1' }, opts)
  assert.equal(r1.added, true)
  const r2 = await addInstinct({ signal: 's1', rule: 'r2', pattern: 'p2' }, opts)
  assert.equal(r2.added, false)
  assert.equal(r2.duplicate, true)
  const list = await inject(null, opts)
  assert.equal(list.length, 1)
})

test('observe bumps hit_count and confidence', async () => {
  const memFile = path.join(await mkdtemp(path.join(tmpdir(), 'fis-mem-')), 'instincts.json')
  const opts = { memoryFile: memFile }
  await addInstinct({ signal: 's1', rule: 'r1' }, opts)
  const before = (await inject(null, opts))[0]
  const res = await observe('s1', opts)
  assert.equal(res.found, true)
  assert.equal(res.record.hit_count, 1)
  assert.ok(res.record.confidence > before.confidence)
})

test('correct lowers confidence', async () => {
  const memFile = path.join(await mkdtemp(path.join(tmpdir(), 'fis-mem-')), 'instincts.json')
  const opts = { memoryFile: memFile }
  await addInstinct({ signal: 's1', rule: 'r1', confidence: 0.8 }, opts)
  const res = await correct('s1', opts)
  assert.equal(res.found, true)
  assert.ok(res.record.confidence < 0.8)
})

test('promote returns mature instincts only', async () => {
  const memFile = path.join(await mkdtemp(path.join(tmpdir(), 'fis-mem-')), 'instincts.json')
  const opts = { memoryFile: memFile }
  await addInstinct({ signal: 'low', rule: 'r', confidence: 0.3 }, opts)
  await addInstinct({ signal: 'high', rule: 'r', confidence: 0.8 }, opts)
  const mature = await promote(0.7, opts)
  assert.equal(mature.length, 1)
  assert.equal(mature[0].signal, 'high')
})

test('reflect derives one rule from a recovery', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-task-'))
  const memFile = path.join(await mkdtemp(path.join(tmpdir(), 'fis-mem-')), 'instincts.json')
  await appendDecision(dir, {
    id: 'R-1',
    type: 'recovery',
    failure_class: 'missing_verify',
    what_failed: 'no read-back',
    prevention: 'always verify read-back',
  })
  const res = await reflect(dir, { task_id: 't1', task_family: 'crud' }, { memoryFile: memFile })
  assert.equal(res.added, true)
  const list = await inject('crud', { memoryFile: memFile })
  assert.equal(list.length, 1)
  assert.equal(list[0].signal, 'fis_missing_verify')
})

test('reflect reports nothing new without recoveries', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-task-'))
  const memFile = path.join(await mkdtemp(path.join(tmpdir(), 'fis-mem-')), 'instincts.json')
  const res = await reflect(dir, { task_id: 't2', task_family: 'crud' }, { memoryFile: memFile })
  assert.equal(res.added, false)
  assert.match(res.reason, /nothing new/)
})
