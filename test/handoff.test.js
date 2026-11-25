import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { writeHandoff, readHandoff } from '../lib/pipeline/handoff.js'

test('writeHandoff and readHandoff round-trip', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-handoff-'))
  try {
    const w = await writeHandoff(dir, { to: 'stage-2', summary: 'done', next_steps: ['x'], artifacts: ['a.json'] })
    assert.equal(w.to, 'stage-2')
    const r = await readHandoff(dir)
    assert.equal(r.summary, 'done')
    assert.deepEqual(r.next_steps, ['x'])
    assert.deepEqual(r.artifacts, ['a.json'])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('readHandoff returns null when missing', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-handoff-'))
  try {
    assert.equal(await readHandoff(path.join(dir, 'nope')), null)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
