import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { initAcceptance, loadAcceptance, flipToPassing, pending, done, isComplete, progress } from '../lib/pipeline/acceptance.js'

test('initAcceptance creates a checklist with all passes false', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-acc-'))
  try {
    await initAcceptance(dir, [{ id: 'a', description: 'd1' }, { id: 'b', description: 'd2' }])
    const list = await loadAcceptance(dir)
    assert.equal(list.length, 2)
    assert.ok(list.every((it) => it.passes === false))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('initAcceptance fails closed on an existing checklist', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-acc-'))
  try {
    await initAcceptance(dir, [{ id: 'a', description: 'd' }])
    await assert.rejects(() => initAcceptance(dir, [{ id: 'b', description: 'x' }]), /already exists/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('initAcceptance rejects missing id and empty criteria', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-acc-'))
  try {
    await assert.rejects(() => initAcceptance(dir, [{ description: 'no id' }]), /requires/)
    await assert.rejects(() => initAcceptance(dir, []), /non-empty/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('flipToPassing flips only false→true and is idempotent', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-acc-'))
  try {
    await initAcceptance(dir, [{ id: 'a', description: 'd' }, { id: 'b', description: 'd2' }])
    const r = await flipToPassing(dir, 'a')
    assert.equal(r.flipped, true)
    assert.equal(r.item.passes, true)
    assert.ok(r.item.verified_at)
    const again = await flipToPassing(dir, 'a')
    assert.equal(again.flipped, false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('flipToPassing throws on unknown id', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-acc-'))
  try {
    await initAcceptance(dir, [{ id: 'a', description: 'd' }])
    await assert.rejects(() => flipToPassing(dir, 'nope'), /unknown criterion/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('pending/done/isComplete/progress reflect state', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-acc-'))
  try {
    await initAcceptance(dir, [{ id: 'a', description: 'd1' }, { id: 'b', description: 'd2' }])
    assert.equal((await pending(dir)).length, 2)
    assert.equal(await isComplete(dir), false)
    await flipToPassing(dir, 'a')
    assert.equal((await pending(dir)).length, 1)
    assert.equal((await done(dir)).length, 1)
    assert.equal(await isComplete(dir), false)
    await flipToPassing(dir, 'b')
    assert.equal(await isComplete(dir), true)
    assert.deepEqual(await progress(dir), { total: 2, passed: 2, pending: 0, complete: true })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('loadAcceptance returns [] for a missing file', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-acc-'))
  try {
    assert.deepEqual(await loadAcceptance(path.join(dir, 'nope')), [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
