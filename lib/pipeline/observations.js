// observations.js — deterministic tool-response envelope + output bounding.
// Every REST-tool response the agent sees should go through wrapToolResponse()
// so the model gets a compact, actionable shape instead of raw platform JSON.
import { config } from './config.js'

/**
 * Wrap a tool result into a deterministic envelope:
 *   { status, summary, next_actions, artifacts, recovery_hint, data? }
 * @param {object} parts — { status?, summary?, next_actions?, artifacts?, recovery_hint?, data?, error? }
 * @returns {object} envelope
 */
export function wrapToolResponse(parts = {}) {
  const status = parts.status ?? (parts.error ? 'error' : 'success')
  const envelope = {
    status,
    summary: parts.summary ?? '',
    next_actions: Array.isArray(parts.next_actions) ? parts.next_actions : [],
    artifacts: Array.isArray(parts.artifacts) ? parts.artifacts : [],
    recovery_hint: parts.recovery_hint ?? null,
  }
  if (status === 'error' && parts.error) envelope.error = String(parts.error?.message ?? parts.error)
  if (parts.data !== undefined) envelope.data = parts.data
  return envelope
}

/** Build an error envelope with an optional recovery hint. */
export function toolError(toolName, error, { recoveryHint = null } = {}) {
  return wrapToolResponse({
    status: 'error',
    summary: `${toolName} failed: ${error?.message ?? error}`,
    recovery_hint: recoveryHint,
    error,
  })
}

/**
 * Bound a JSON payload to a byte budget. Returns the data unchanged when small;
 * otherwise returns { truncated, preview, original_bytes }. The preview is a
 * best-effort string slice and is intentionally not valid JSON.
 */
export function truncateJson(data, { maxBytes, marker } = {}) {
  const max = maxBytes ?? config.observations.maxDataBytes
  const m = marker ?? config.observations.truncationMarker
  const s = JSON.stringify(data)
  const bytes = Buffer.byteLength(s, 'utf8')
  if (bytes <= max) return data
  const head = s.slice(0, Math.max(0, max - Buffer.byteLength(m, 'utf8')))
  return { truncated: true, preview: head + m, original_bytes: bytes }
}
