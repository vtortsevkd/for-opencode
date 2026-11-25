import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { appendDecision, decisionsFor, verifyChain } from '../lib/pipeline/ledger.js'

test('appends and reads decisions in order', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-ledger-'))
  try {
    await appendDecision(dir, { id: 'D-001', stage: 1, gate: 'a', decision: 'x' })
    await appendDecision(dir, { id: 'D-002', stage: 2, gate: 'b', decision: 'y' })
    const ds = await decisionsFor(dir)
    assert.equal(ds.length, 2)
    assert.equal(ds[0].id, 'D-001')
    assert.equal(ds[1].id, 'D-002')
    assert.ok(ds[0].ts) // ts auto-added
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('verifyChain passes on an unmodified journal', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-ledger-'))
  try {
    await appendDecision(dir, { id: 'D-001', decision: 'a' })
    await appendDecision(dir, { id: 'D-002', decision: 'b' })
    const v = await verifyChain(dir)
    assert.equal(v.valid, true)
    assert.equal(v.records, 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('rewriting history breaks the chain', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-ledger-'))
  try {
    await appendDecision(dir, { id: 'D-001', decision: 'a' })
    await appendDecision(dir, { id: 'D-002', decision: 'b' })
    const file = path.join(dir, 'decisions.jsonl')
    const raw = await readFile(file, 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    lines[0] = JSON.stringify({ id: 'D-001', decision: 'TAMPERED', ts: '2020-01-01T00:00:00Z' })
    await writeFile(file, lines.join('\n') + '\n', 'utf8')
    const v = await verifyChain(dir)
    assert.equal(v.valid, false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('decisionsFor returns [] for a missing journal', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-ledger-'))
  try {
    const ds = await decisionsFor(path.join(dir, 'does-not-exist'))
    assert.deepEqual(ds, [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
