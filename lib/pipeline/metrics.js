// metrics.js — NDJSON metrics emission + pass@k / cost aggregation.
// Zero-dependency: node:fs/promises only.
import { appendFile, mkdir, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { config } from './config.js'

function resolveMetricsDir(metricsDir) {
  return metricsDir || config.paths.metricsDir
}

function runFile(metricsDir, taskFamily, runId) {
  return path.join(metricsDir, taskFamily, `run-${runId}.jsonl`)
}

/**
 * Append one metric event as a single JSONL line.
 * @param {object} event — requires { task_family, run_id, event }. See plan for fields.
 * @param {object} [opts] — { metricsDir }
 * @returns {Promise<string>} the file path written to.
 */
export async function record(event, { metricsDir } = {}) {
  if (!event || typeof event !== 'object') throw new Error('record(): event object required')
  const { task_family, run_id } = event
  if (!task_family || !run_id) throw new Error('record(): event requires task_family and run_id')
  const dir = resolveMetricsDir(metricsDir)
  const file = runFile(dir, task_family, run_id)
  await mkdir(path.dirname(file), { recursive: true })
  await appendFile(file, JSON.stringify(event) + '\n', 'utf8')
  return file
}

async function readRunFiles(metricsDir, taskFamily) {
  const familyDir = path.join(resolveMetricsDir(metricsDir), taskFamily)
  let entries
  try {
    entries = await readdir(familyDir, { withFileTypes: true })
  } catch (e) {
    if (e.code === 'ENOENT') return []
    throw e
  }
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.jsonl'))
    .map((e) => path.join(familyDir, e.name))
  const out = []
  for (const f of files) {
    const raw = await readFile(f, 'utf8')
    const events = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l))
    out.push({ file: f, events })
  }
  return out
}

async function listFamilies(metricsDir) {
  const dir = resolveMetricsDir(metricsDir)
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (e) {
    if (e.code === 'ENOENT') return []
    throw e
  }
  return entries.filter((e) => e.isDirectory()).map((e) => e.name)
}

function summarize(events) {
  const taskMap = new Map()
  for (const ev of events) {
    if (!ev.task_id) continue
    if (!taskMap.has(ev.task_id)) {
      taskMap.set(ev.task_id, { stages: new Map(), duration: 0, tokens: 0, ttft_ms: null, cache_total: 0, cache_hits: 0, done: false, failed: false, escalated: false })
    }
    const t = taskMap.get(ev.task_id)
    if (ev.event === 'task_end') {
      if (ev.outcome === 'done') t.done = true
      else if (ev.outcome === 'escalated') t.escalated = true
      else t.failed = true
    }
    if (typeof ev.duration_ms === 'number') t.duration += ev.duration_ms
    if (typeof ev.tokens_used === 'number') t.tokens += ev.tokens_used
    if (ev.event === 'ttft' && typeof ev.ttft_ms === 'number') t.ttft_ms = ev.ttft_ms
    if (ev.event === 'cache') {
      t.cache_total += 1
      if (ev.hit) t.cache_hits += 1
    }
    if (ev.stage) {
      const cur = t.stages.get(ev.stage) || { maxAttempt: 0, fails: 0 }
      if (typeof ev.attempt_number === 'number') cur.maxAttempt = Math.max(cur.maxAttempt, ev.attempt_number)
      if (
        (ev.event === 'stage_end' || ev.event === 'gate' || ev.event === 'judge' || ev.event === 'attack') &&
        ev.outcome === 'fail'
      ) {
        cur.fails += 1
      }
      t.stages.set(ev.stage, cur)
    }
  }

  const tasks = []
  for (const [taskId, t] of taskMap) {
    let totalAttempts = 0
    let maxAttempt = 0
    const stageFails = {}
    for (const [stage, s] of t.stages) {
      const attempts = s.maxAttempt || 1
      totalAttempts += attempts
      maxAttempt = Math.max(maxAttempt, attempts)
      stageFails[stage] = s.fails
    }
    tasks.push({
      task_id: taskId,
      done: t.done,
      failed: t.failed,
      escalated: t.escalated,
      total_attempts: totalAttempts,
      max_attempt: maxAttempt,
      duration_ms: t.duration,
      tokens_used: t.tokens,
      ttft_ms: t.ttft_ms,
      cache_total: t.cache_total,
      cache_hits: t.cache_hits,
      stage_fails: stageFails,
    })
  }
  return tasks
}

/**
 * Aggregate metrics into pass@1 / pass@3 / cost per task family.
 * @param {object} [opts] — { taskFamily?: string|null, metricsDir?: string }
 * @returns {Promise<object>} { families: { [family]: {...} } }
 */
export async function aggregateReport({ taskFamily = null, metricsDir } = {}) {
  const dir = resolveMetricsDir(metricsDir)
  const families = taskFamily ? [taskFamily] : await listFamilies(dir)
  const report = { families: {} }

  for (const fam of families) {
    const runFiles = await readRunFiles(dir, fam)
    const tasks = []
    for (const rf of runFiles) tasks.push(...summarize(rf.events))

    const total = tasks.length
    const done = tasks.filter((t) => t.done)
    const pass1 = done.filter((t) => t.max_attempt <= 1).length
    const pass3 = done.filter((t) => t.total_attempts <= 3).length
    const avgDuration = total ? Math.round(tasks.reduce((a, t) => a + t.duration_ms, 0) / total) : 0
    const avgAttempts = total ? Number((tasks.reduce((a, t) => a + t.total_attempts, 0) / total).toFixed(2)) : 0
    const ttfts = tasks.filter((t) => t.ttft_ms != null).map((t) => t.ttft_ms)
    const avgTtft = ttfts.length ? Math.round(ttfts.reduce((a, b) => a + b, 0) / ttfts.length) : null
    const cacheTotal = tasks.reduce((a, t) => a + t.cache_total, 0)
    const cacheHits = tasks.reduce((a, t) => a + t.cache_hits, 0)
    const cacheHitRate = cacheTotal ? Math.round((cacheHits / cacheTotal) * 100) : null

    const stageFailCount = {}
    for (const t of tasks) {
      for (const [s, n] of Object.entries(t.stage_fails)) stageFailCount[s] = (stageFailCount[s] || 0) + n
    }
    const topFailingStages = Object.entries(stageFailCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([stage, fails]) => ({ stage, fails }))

    report.families[fam] = {
      total,
      done: done.length,
      failed: tasks.filter((t) => t.failed).length,
      escalated: tasks.filter((t) => t.escalated).length,
      pass_at_1_pct: total ? Math.round((pass1 / total) * 100) : 0,
      pass_at_3_pct: total ? Math.round((pass3 / total) * 100) : 0,
      avg_duration_ms: avgDuration,
      avg_total_attempts: avgAttempts,
      avg_ttft_ms: avgTtft,
      cache_hit_rate_pct: cacheHitRate,
      top_failing_stages: topFailingStages,
    }
  }
  return report
}

export function formatReport(report) {
  const lines = []
  for (const [fam, r] of Object.entries(report.families)) {
    lines.push(`# ${fam}`)
    lines.push(`  total=${r.total} done=${r.done} failed=${r.failed} escalated=${r.escalated}`)
    lines.push(`  pass@1=${r.pass_at_1_pct}%  pass@3=${r.pass_at_3_pct}%`)
    lines.push(`  avg_duration_ms=${r.avg_duration_ms}  avg_total_attempts=${r.avg_total_attempts}`)
    if (r.avg_ttft_ms != null) lines.push(`  avg_ttft_ms=${r.avg_ttft_ms}  cache_hit_rate=${r.cache_hit_rate_pct}%`)
    if (r.top_failing_stages.length) {
      lines.push(`  top_failing_stages: ${r.top_failing_stages.map((s) => `${s.stage}(${s.fails})`).join(', ')}`)
    }
  }
  return lines.join('\n')
}

/** Record a time-to-first-token sample. */
export async function recordTtft({ task_family, run_id, task_id, ttft_ms }, opts) {
  return record({ task_family, run_id, task_id, event: 'ttft', ttft_ms }, opts)
}

/** Record a prompt-cache hit/miss. */
export async function recordCache({ task_family, run_id, task_id, hit }, opts) {
  return record({ task_family, run_id, task_id, event: 'cache', hit: !!hit }, opts)
}
