// session.js — the session is a durable append-only event log OUTSIDE the
// context window. The window is just a queryable slice of this log. Compaction
// and trimming are irreversible; the fix is to keep everything and slice on demand.
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'

export function sessionFile(taskDir) {
  return path.join(taskDir, 'session.jsonl')
}

function nextEventId() {
  return `E-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Append one event (append-only). Returns the record as written. */
export async function emitEvent(taskDir, event) {
  if (!event || !event.type) throw new Error('emitEvent(): event.type required')
  const file = sessionFile(taskDir)
  await mkdir(path.dirname(file), { recursive: true })
  const record = { id: nextEventId(), ts: new Date().toISOString(), ...event }
  await appendFile(file, JSON.stringify(record) + '\n', 'utf8')
  return record
}

async function readAll(taskDir) {
  const file = sessionFile(taskDir)
  let raw
  try {
    raw = await readFile(file, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return []
    throw e
  }
  return raw.split('\n').filter(Boolean).map((l) => JSON.parse(l))
}

/**
 * Query the event log with positional slicing + type filter.
 * `from`/`to` are indices into the full stream (like slicing a list).
 */
export async function getEvents(taskDir, { from, to, type, limit, offset = 0 } = {}) {
  let events = await readAll(taskDir)
  if (from != null) events = events.slice(from)
  if (to != null) events = events.slice(0, to)
  if (type) events = events.filter((e) => e.type === type)
  if (offset) events = events.slice(offset)
  if (limit != null) events = events.slice(0, limit)
  return events
}

/** Last n events. */
export async function tail(taskDir, n = 10) {
  return (await readAll(taskDir)).slice(-n)
}

/** Events before a given event id (rewind the stream). */
export async function rewind(taskDir, { beforeId }) {
  const events = await readAll(taskDir)
  if (!beforeId) return events
  const idx = events.findIndex((e) => e.id === beforeId)
  return idx === -1 ? events : events.slice(0, idx)
}
