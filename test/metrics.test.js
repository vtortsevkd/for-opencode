import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { record, aggregateReport, formatReport, recordTtft, recordCache } from '../lib/pipeline/metrics.js'

async function emitTask(metricsDir, taskId, runId, outcomes, family = 'crud') {
  await record({ task_family: family, task_id: taskId, run_id: runId, ts: new Date().toISOString(), event: 'task_start' }, { metricsDir })
  for (const [stage, outcome, attempt] of outcomes) {
    await record(
      { task_family: family, task_id: taskId, run_id: runId, ts: new Date().toISOString(), event: 'stage_end', stage, outcome, attempt_number: attempt, duration_ms: 100 },
      { metricsDir }
    )
  }
  const final = outcomes.every((o) => o[1] === 'pass') ? 'done' : 'failed'
  await record({ task_family: family, task_id: taskId, run_id: runId, ts: new Date().toISOString(), event: 'task_end', outcome: final }, { metricsDir })
}

test('pass@1 = 100% when no stage repeats', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-metrics-'))
  try {
    await emitTask(dir, 't1', 'r1', [['plan', 'pass', 1], ['impl', 'pass', 1]])
    const rep = await aggregateReport({ taskFamily: 'crud', metricsDir: dir })
    assert.equal(rep.families.crud.pass_at_1_pct, 100)
    assert.equal(rep.families.crud.pass_at_3_pct, 100)
    assert.equal(rep.families.crud.done, 1)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('pass@1 drops on repeat, pass@3 holds', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-metrics-'))
  try {
    await emitTask(dir, 't1', 'r1', [['plan', 'pass', 1], ['impl', 'pass', 2]]) // total attempts 3
    const rep = await aggregateReport({ taskFamily: 'crud', metricsDir: dir })
    assert.equal(rep.families.crud.pass_at_1_pct, 0)
    assert.equal(rep.families.crud.pass_at_3_pct, 100)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('failed task is not counted as pass', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-metrics-'))
  try {
    await emitTask(dir, 't1', 'r1', [['plan', 'fail', 1], ['impl', 'pass', 1]])
    const rep = await aggregateReport({ taskFamily: 'crud', metricsDir: dir })
    assert.equal(rep.families.crud.done, 0)
    assert.equal(rep.families.crud.failed, 1)
    assert.equal(rep.families.crud.pass_at_1_pct, 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('formatReport renders without throwing', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-metrics-'))
  try {
    await emitTask(dir, 't1', 'r1', [['plan', 'pass', 1], ['impl', 'pass', 1]])
    const rep = await aggregateReport({ taskFamily: 'crud', metricsDir: dir })
    const text = formatReport(rep)
    assert.match(text, /pass@1=100%/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('aggregateReport surfaces avg_ttft_ms and cache_hit_rate', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-metrics-'))
  try {
    await record({ task_family: 'crud', task_id: 't1', run_id: 'r1', event: 'task_start' }, { metricsDir: dir })
    await recordTtft({ task_family: 'crud', run_id: 'r1', task_id: 't1', ttft_ms: 120 }, { metricsDir: dir })
    await recordCache({ task_family: 'crud', run_id: 'r1', task_id: 't1', hit: true }, { metricsDir: dir })
    await recordCache({ task_family: 'crud', run_id: 'r1', task_id: 't1', hit: false }, { metricsDir: dir })
    await record({ task_family: 'crud', task_id: 't1', run_id: 'r1', event: 'task_end', outcome: 'done' }, { metricsDir: dir })
    const rep = await aggregateReport({ taskFamily: 'crud', metricsDir: dir })
    assert.equal(rep.families.crud.avg_ttft_ms, 120)
    assert.equal(rep.families.crud.cache_hit_rate_pct, 50)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
