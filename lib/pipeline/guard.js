// guard.js — fail-closed boundary for privileged / irreversible operations.
// Model output and task text are untrusted: validate at the action boundary
// (the REST-tool entry point), never only in the prompt.
import { config } from './config.js'

const SAFE_ID = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/

/**
 * Validate an identifier that will become an object name, key, filename, or
 * command argument. Allowlist of characters, length-capped, rejects empty.
 * @param {string} value
 * @param {object} [opts] — { maxLength }
 * @returns {string} the validated id
 */
export function requireSafeId(value, { maxLength = config.guard.maxIdLength } = {}) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength || !SAFE_ID.test(value)) {
    throw new Error(`invalid identifier: "${value}"`)
  }
  return value
}

/** Whether an operation name is classified as irreversible (needs confirmation). */
export function isIrreversible(operation) {
  return config.guard.confirmRequired.includes(operation)
}

/**
 * Fail-closed guard: authorize → confirm → execute. If authorize or confirm is
 * missing/denies, the side effect never runs.
 * @param {object} opts
 *   - authorize: async (input) => { allowed: boolean, reason?: string }
 *   - confirm:   async (input) => boolean   (human or scoped pre-approval)
 *   - execute:   async (input) => any       (the actual REST mutation)
 *   - input:     any
 * @returns {Promise<{ok: boolean, status: 'blocked'|'unconfirmed'|'executed', reason?, result?}>}
 */
export async function runGuarded({ authorize, confirm, execute, input }) {
  if (typeof execute !== 'function') throw new Error('runGuarded(): execute function required')

  const auth = await (typeof authorize === 'function' ? authorize(input) : { allowed: false, reason: 'no authorize() provided' })
  if (!auth?.allowed) return { ok: false, status: 'blocked', reason: auth?.reason || 'not authorized' }

  const confirmed = await (typeof confirm === 'function' ? confirm(input) : false)
  if (!confirmed) return { ok: false, status: 'unconfirmed', reason: 'explicit confirmation required' }

  const result = await execute(input)
  return { ok: true, status: 'executed', result }
}

/**
 * Assess downstream impact before mutating a shared object. Blocks `delete`
 * when downstream references exist; surfaces references for `update`.
 * @param {object} opts — { enumerateDownstream: async (id) => string[], id, operation }
 * @returns {Promise<{checked: boolean, references: string[], blocking: boolean, message?: string|null}>}
 */
export async function assessImpact({ enumerateDownstream, id, operation }) {
  if (typeof enumerateDownstream !== 'function' || !id) {
    return { checked: false, references: [], blocking: false, message: null }
  }
  const references = await enumerateDownstream(id)
  const refs = Array.isArray(references) ? references : []
  const blocking = operation === 'delete' && refs.length > 0
  return {
    checked: true,
    references: refs,
    blocking,
    message: blocking ? `delete blocked: ${refs.length} downstream reference(s)` : null,
  }
}

const DEFAULT_TRUSTED_ORIGINS = ['file://', 'app://']

/**
 * Validate an IPC sender origin against an allowlist. In Electron, pass
 * `event.senderFrame?.url`. Rejects remote origins unless explicitly allowed.
 * @param {string|null|undefined} senderUrl
 * @param {object} [opts] — { trustedOrigins?: string[] }
 * @returns {boolean}
 */
export function isTrustedSender(senderUrl, { trustedOrigins = DEFAULT_TRUSTED_ORIGINS } = {}) {
  if (typeof senderUrl !== 'string' || senderUrl.length === 0) return false
  return trustedOrigins.some((o) => senderUrl === o || senderUrl.startsWith(o))
}
