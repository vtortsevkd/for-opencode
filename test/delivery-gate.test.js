import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { initAcceptance, flipToPassing } from '../lib/pipeline/acceptance.js'
import { appendDecision } from '../lib/pipeline/ledger.js'
import { reflect } from '../lib/pipeline/memory/instincts.js'
import { deliveryGate } from '../lib/pipeline/delivery-gate.js'

test('deliveryGate blocks when nothing is done', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-gate-'))
  try {
    const g = await deliveryGate(dir, { testsPassed: false })
    assert.equal(g.ready, false)
    assert.ok(g.blockers.length > 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('deliveryGate is ready when the full loop is closed', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-gate-'))
  try {
    await initAcceptance(dir, [{ id: 'a', description: 'd' }])
    await flipToPassing(dir, 'a')
    await reflect(dir, { task_id: 't1', task_family: 'crud' }, { memoryFile: path.join(dir, 'mem.json') })
    const g = await deliveryGate(dir, { testsPassed: true })
    assert.equal(g.ready, true)
    assert.deepEqual(g.blockers, [])
    assert.equal(g.checks.reflectionDone, true)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('deliveryGate blocks on incomplete acceptance', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-gate-'))
  try {
    await initAcceptance(dir, [{ id: 'a', description: 'd' }, { id: 'b', description: 'd2' }])
    await flipToPassing(dir, 'a')
    await reflect(dir, { task_id: 't1' }, { memoryFile: path.join(dir, 'mem.json') })
    const g = await deliveryGate(dir, { testsPassed: true })
    assert.equal(g.ready, false)
    assert.ok(g.blockers.some((b) => /acceptance/.test(b)))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('deliveryGate flags a broken ledger chain', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-gate-'))
  try {
    await appendDecision(dir, { id: 'D-1', decision: 'a' })
    await appendDecision(dir, { id: 'D-2', decision: 'b' })
    const file = path.join(dir, 'decisions.jsonl')
    const raw = await readFile(file, 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    lines[0] = JSON.stringify({ id: 'D-1', decision: 'TAMPERED' })
    await writeFile(file, lines.join('\n') + '\n', 'utf8')
    const g = await deliveryGate(dir, { testsPassed: true })
    assert.equal(g.ready, false)
    assert.ok(g.blockers.some((b) => /chain broken/.test(b)))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
