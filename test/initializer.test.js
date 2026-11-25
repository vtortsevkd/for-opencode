import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { initTask, appendProgressNote } from '../lib/pipeline/initializer.js'
import { loadAcceptance } from '../lib/pipeline/acceptance.js'
import { decisionsFor } from '../lib/pipeline/ledger.js'

test('initTask scaffolds acceptance + progress + empty ledger', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-init-'))
  try {
    const r = await initTask(dir, { taskId: 't1', taskFamily: 'crud', criteria: [{ id: 'a', description: 'd' }] })
    assert.equal(r.acceptance.length, 1)
    assert.equal((await loadAcceptance(dir)).length, 1)
    assert.deepEqual(await decisionsFor(dir), [])
    const p = JSON.parse(await readFile(path.join(dir, 'progress.json'), 'utf8'))
    assert.equal(p.task_id, 't1')
    assert.equal(p.status, 'in_progress')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('initTask fails closed if already initialized', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-init-'))
  try {
    await initTask(dir, { taskId: 't1', taskFamily: 'crud', criteria: [{ id: 'a', description: 'd' }] })
    await assert.rejects(() => initTask(dir, { taskId: 't1', taskFamily: 'crud', criteria: [{ id: 'b', description: 'x' }] }), /already exists/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('appendProgressNote adds a note', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-init-'))
  try {
    await initTask(dir, { taskId: 't1', taskFamily: 'crud', criteria: [{ id: 'a', description: 'd' }] })
    const p = await appendProgressNote(dir, 'did smoke test')
    assert.equal(p.notes.length, 1)
    assert.equal(p.notes[0].note, 'did smoke test')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
