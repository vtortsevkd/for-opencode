import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { addInstinct, inject, observe, correct, promote, reflect, pruneInstincts, decayConfidence, byKind } from '../lib/pipeline/memory/instincts.js'
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

test('addInstinct defaults kind to lesson', async () => {
  const memFile = path.join(await mkdtemp(path.join(tmpdir(), 'fis-mem-')), 'instincts.json')
  const opts = { memoryFile: memFile }
  await addInstinct({ signal: 's1', rule: 'r1' }, opts)
  const list = await inject(null, opts)
  assert.equal(list[0].kind, 'lesson')
})

test('byKind filters by kind', async () => {
  const memFile = path.join(await mkdtemp(path.join(tmpdir(), 'fis-mem-')), 'instincts.json')
  const opts = { memoryFile: memFile }
  await addInstinct({ signal: 's1', rule: 'r1', kind: 'note' }, opts)
  await addInstinct({ signal: 's2', rule: 'r2', kind: 'lesson' }, opts)
  const notes = await byKind('note', opts)
  assert.equal(notes.length, 1)
  assert.equal(notes[0].signal, 's1')
})

test('observe sets last_observed_at', async () => {
  const memFile = path.join(await mkdtemp(path.join(tmpdir(), 'fis-mem-')), 'instincts.json')
  const opts = { memoryFile: memFile }
  await addInstinct({ signal: 's1', rule: 'r1' }, opts)
  await observe('s1', opts)
  const list = await inject(null, opts)
  assert.ok(list[0].last_observed_at)
})

test('decayConfidence lowers confidence for stale instincts', async () => {
  const memFile = path.join(await mkdtemp(path.join(tmpdir(), 'fis-mem-')), 'instincts.json')
  const opts = { memoryFile: memFile }
  await addInstinct({ signal: 's1', rule: 'r1', confidence: 0.8 }, opts)
  const raw = JSON.parse(await readFile(memFile, 'utf8'))
  raw[0].added_at = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString()
  await writeFile(memFile, JSON.stringify(raw, null, 2) + '\n', 'utf8')
  await decayConfidence(opts)
  const list = await inject(null, opts)
  assert.ok(list[0].confidence < 0.8)
})

test('pruneInstincts removes stale never-observed instincts', async () => {
  const memFile = path.join(await mkdtemp(path.join(tmpdir(), 'fis-mem-')), 'instincts.json')
  const opts = { memoryFile: memFile }
  await addInstinct({ signal: 'stale', rule: 'r1' }, opts)
  await addInstinct({ signal: 'fresh', rule: 'r2' }, opts)
  const raw = JSON.parse(await readFile(memFile, 'utf8'))
  raw.find((r) => r.signal === 'stale').added_at = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString()
  await writeFile(memFile, JSON.stringify(raw, null, 2) + '\n', 'utf8')
  const res = await pruneInstincts(opts)
  assert.equal(res.removedCount, 1)
  assert.equal(res.keptCount, 1)
  const list = await inject(null, opts)
  assert.equal(list.length, 1)
  assert.equal(list[0].signal, 'fresh')
})

test('pruneInstincts keeps stale instincts that were observed', async () => {
  const memFile = path.join(await mkdtemp(path.join(tmpdir(), 'fis-mem-')), 'instincts.json')
  const opts = { memoryFile: memFile }
  await addInstinct({ signal: 's1', rule: 'r1' }, opts)
  await observe('s1', opts) // hit_count → 1
  const raw = JSON.parse(await readFile(memFile, 'utf8'))
  raw[0].added_at = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString()
  await writeFile(memFile, JSON.stringify(raw, null, 2) + '\n', 'utf8')
  const res = await pruneInstincts(opts)
  assert.equal(res.removedCount, 0)
})
