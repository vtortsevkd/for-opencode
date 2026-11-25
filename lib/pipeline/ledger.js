// ledger.js — append-only decision journal with hash-chain integrity.
// Every new record links to the sha256 of the previous raw line, so any
// rewrite of history is detectable via verifyChain().
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

function sha256(s) {
  return createHash('sha256').update(s).digest('hex')
}

export function ledgerFile(taskDir) {
  return path.join(taskDir, 'decisions.jsonl')
}

async function lastRawLine(file) {
  let raw
  try {
    raw = await readFile(file, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return null
    throw e
  }
  const lines = raw.split('\n').filter(Boolean)
  return lines.length ? lines[lines.length - 1] : null
}

/**
 * Append one decision record (append-only). The file is opened in 'a' mode
 * and never read-modify-written.
 * @param {string} taskDir — directory of the current task.
 * @param {object} decision — requires { id }. See plan for full shape.
 * @returns {Promise<object>} the record as written (with ts + prev_hash).
 */
export async function appendDecision(taskDir, decision) {
  if (!decision || typeof decision !== 'object') throw new Error('appendDecision(): decision object required')
  if (!decision.id) throw new Error('appendDecision(): decision.id required')
  const file = ledgerFile(taskDir)
  await mkdir(path.dirname(file), { recursive: true })
  const prev = await lastRawLine(file)
  const record = { ...decision, ts: decision.ts || new Date().toISOString() }
  if (prev) record.prev_hash = sha256(prev)
  await appendFile(file, JSON.stringify(record) + '\n', 'utf8')
  return record
}

/** Read all decisions for a task (empty array if none). */
export async function decisionsFor(taskDir) {
  const file = ledgerFile(taskDir)
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
 * Verify the hash chain: every record (except the first) must carry a
 * prev_hash equal to sha256 of the raw previous line.
 * @returns {Promise<{valid: boolean, records?: number, broken_index?: number}>}
 */
export async function verifyChain(taskDir) {
  const file = ledgerFile(taskDir)
  let raw
  try {
    raw = await readFile(file, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return { valid: true, records: 0 }
    throw e
  }
  const lines = raw.split('\n').filter(Boolean)
  for (let i = 1; i < lines.length; i++) {
    const expected = sha256(lines[i - 1])
    const rec = JSON.parse(lines[i])
    if (rec.prev_hash !== expected) return { valid: false, broken_index: i }
  }
  return { valid: true, records: lines.length }
}
