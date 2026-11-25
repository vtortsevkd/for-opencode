import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { diagnoseFailure, recover, logRecovery, stallDetector } from '../lib/pipeline/recovery.js'

test('diagnoseFailure classifies judge_flake', () => {
  const fail = { checks: [{ name: 'x', type: 'code', result: 'pass' }, { name: 'y', type: 'llm', result: 'fail' }] }
  assert.equal(diagnoseFailure(fail), 'judge_flake')
})

test('diagnoseFailure classifies missing_verify', () => {
  const fail = { checks: [{ name: 'verify_read_back', type: 'code', result: 'fail' }] }
  assert.equal(diagnoseFailure(fail), 'missing_verify')
})

test('diagnoseFailure classifies schema_mismatch', () => {
  const fail = { checks: [{ name: 'schema_valid', type: 'rule', result: 'fail' }] }
  assert.equal(diagnoseFailure(fail), 'schema_mismatch')
})

test('diagnoseFailure honors an explicit failure_class', () => {
  assert.equal(diagnoseFailure({ failure_class: 'invalid_input' }), 'invalid_input')
})

test('recover() scopes to a single artifact', () => {
  const r = recover('artifacts/x.json', 'missing_verify')
  assert.equal(r.scope, 'single_artifact')
  assert.equal(r.artifact, 'artifacts/x.json')
  assert.equal(r.failure_class, 'missing_verify')
})

test('stallDetector continues below threshold', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-rec-'))
  try {
    await logRecovery(dir, { id: 'R-1', stage: 3, failure_class: 'missing_verify', what_failed: 'a', what_fixed: 'b' })
    const s = await stallDetector(dir, 3, { failure_class: 'missing_verify' })
    assert.equal(s.continue, true)
    assert.equal(s.escalate, false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('stallDetector escalates at maxAttemptsPerStage', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-rec-'))
  try {
    await logRecovery(dir, { id: 'R-1', stage: 3, failure_class: 'missing_verify', what_failed: 'a', what_fixed: 'b' })
    await logRecovery(dir, { id: 'R-2', stage: 3, failure_class: 'missing_verify', what_failed: 'a', what_fixed: 'b' })
    // attempts = 2 recoveries + 1 first generation = 3 >= maxAttemptsPerStage(3)
    const s = await stallDetector(dir, 3, { failure_class: 'missing_verify' })
    assert.equal(s.continue, false)
    assert.equal(s.escalate, true)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
