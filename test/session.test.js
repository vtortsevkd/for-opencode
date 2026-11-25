import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { emitEvent, getEvents, tail, rewind } from '../lib/pipeline/session.js'

test('emitEvent appends and getEvents reads in order', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-session-'))
  try {
    await emitEvent(dir, { type: 'a', x: 1 })
    await emitEvent(dir, { type: 'b', x: 2 })
    const events = await getEvents(dir)
    assert.equal(events.length, 2)
    assert.equal(events[0].type, 'a')
    assert.equal(events[1].type, 'b')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('getEvents slices by position and filters by type', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-session-'))
  try {
    await emitEvent(dir, { type: 'a' })
    await emitEvent(dir, { type: 'b' })
    await emitEvent(dir, { type: 'a' })
    assert.equal((await getEvents(dir, { from: 1 })).length, 2)
    assert.equal((await getEvents(dir, { to: 2 })).length, 2)
    assert.equal((await getEvents(dir, { type: 'a' })).length, 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('tail returns last n events', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-session-'))
  try {
    for (let i = 0; i < 5; i++) await emitEvent(dir, { type: 'x', i })
    const t = await tail(dir, 2)
    assert.equal(t.length, 2)
    assert.equal(t[1].i, 4)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('rewind returns events before a given id', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-session-'))
  try {
    const e1 = await emitEvent(dir, { type: 'a' })
    await emitEvent(dir, { type: 'b' })
    await emitEvent(dir, { type: 'c' })
    assert.equal((await rewind(dir, { beforeId: e1.id })).length, 0)
    const all = await getEvents(dir)
    const r2 = await rewind(dir, { beforeId: all[2].id })
    assert.equal(r2.length, 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('getEvents returns [] for a missing session', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-session-'))
  try {
    assert.deepEqual(await getEvents(path.join(dir, 'nope')), [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
