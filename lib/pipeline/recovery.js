// recovery.js — diagnose → contained recovery → record, instead of blind retry.
// Plus a stall detector that escalates instead of looping forever.
import { config } from './config.js'
import { appendDecision, decisionsFor } from './ledger.js'

const FAILURE_CLASSES = new Set([
  'schema_mismatch',
  'missing_verify',
  'invalid_input',
  'judge_flake',
  'unknown',
])

/**
 * Classify a failed verdict into a bounded failure class.
 * @param {object} fail — { failure_class?, checks?: [{name,type,result,detail}], input_error? }
 * @returns {string} one of FAILURE_CLASSES.
 */
export function diagnoseFailure(fail = {}) {
  if (fail.failure_class && FAILURE_CLASSES.has(fail.failure_class)) return fail.failure_class
  const checks = Array.isArray(fail.checks) ? fail.checks : []
  const failed = checks.filter((c) => c.result !== 'pass')
  if (failed.length === 0) return 'unknown'

  // judge_flake: deterministic checks all passed, only the LLM judge failed.
  const deterministic = failed.filter((c) => c.type !== 'llm')
  if (deterministic.length === 0) return 'judge_flake'

  // missing_verify: a verify / read-back check failed.
  if (failed.some((c) => /verify|read[_-]?back|readback/i.test(c.name || ''))) return 'missing_verify'

  // schema_mismatch: a schema / validation check failed.
  if (failed.some((c) => /schema|valid|shape/i.test(c.name || '') || c.type === 'rule')) return 'schema_mismatch'

  if (fail.input_error) return 'invalid_input'
  return 'unknown'
}

/**
 * Produce a contained-recovery plan: only the failing artifact may change.
 * @param {string} artifact — path/id of the single failing artifact.
 * @param {string} failureClass — from diagnoseFailure().
 * @returns {object} recovery descriptor.
 */
export function recover(artifact, failureClass) {
  if (!artifact) throw new Error('recover(): artifact path required')
  const fc = FAILURE_CLASSES.has(failureClass) ? failureClass : 'unknown'
  return {
    artifact,
    failure_class: fc,
    scope: 'single_artifact',
    allowed: [artifact],
    forbidden: 'all other artifacts',
    action: `regenerate only "${artifact}" for failure_class=${fc}`,
  }
}

/**
 * Write an introspection record to the decision journal (module 5).
 * @param {string} taskDir
 * @param {object} report — { stage, failure_class, what_failed, what_fixed, prevention, id? }
 */
export async function logRecovery(taskDir, report) {
  if (!report || typeof report !== 'object') throw new Error('logRecovery(): report object required')
  const record = { type: 'recovery', ...report }
  if (!record.id) record.id = `R-${Date.now().toString(36)}`
  return appendDecision(taskDir, record)
}

/**
 * Decide whether to retry or escalate, based on attempt count and
 * consecutive same-class failures for a stage.
 * @param {string} taskDir
 * @param {number|string} stage
 * @param {object} [fail] — { failure_class? } used for stall-streak detection.
 * @returns {Promise<{continue: boolean, escalate: boolean, attempts?: number, streak?: number, reason?: string}>}
 */
export async function stallDetector(taskDir, stage, fail = {}) {
  const decisions = await decisionsFor(taskDir)
  const recoveries = decisions.filter((d) => d.type === 'recovery' && String(d.stage) === String(stage))
  const attempts = recoveries.length + 1 // first generation + each recovery
  const fc = fail.failure_class || 'unknown'

  if (attempts >= config.maxAttemptsPerStage) {
    return {
      continue: false,
      escalate: true,
      attempts,
      reason: `maxAttemptsPerStage (${config.maxAttemptsPerStage}) reached`,
    }
  }

  // Consecutive same-class failures (including the current one).
  let streak = 1
  for (let i = recoveries.length - 1; i >= 0; i--) {
    if (recoveries[i].failure_class === fc) streak += 1
    else break
  }

  if (streak >= config.stallThreshold) {
    return {
      continue: false,
      escalate: true,
      attempts,
      streak,
      reason: `stallThreshold (${config.stallThreshold}) same-class failures`,
    }
  }

  return { continue: true, escalate: false, attempts, streak }
}
