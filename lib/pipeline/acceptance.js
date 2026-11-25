// acceptance.js — canonical acceptance checklist (feature list) in JSON.
// The agent may only flip a criterion from passes:false to passes:true after
// end-to-end verification. The list itself is immutable after init: no adding,
// removing, or editing of items — this prevents "moving the goalposts".
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

export function acceptanceFile(taskDir) {
  return path.join(taskDir, 'acceptance.json')
}

function normalize(criterion) {
  if (!criterion || !criterion.id || !criterion.description) {
    throw new Error('initAcceptance(): each criterion requires { id, description }')
  }
  return {
    id: criterion.id,
    category: criterion.category ?? null,
    description: criterion.description,
    steps: Array.isArray(criterion.steps) ? criterion.steps : [],
    passes: false,
    verified_at: null,
    verified_by: null,
  }
}

/**
 * Create the acceptance checklist once. Fails closed if it already exists.
 * @param {string} taskDir
 * @param {Array<{id, description, category?, steps?}>} criteria
 * @returns {Promise<object[]>} the normalized checklist.
 */
export async function initAcceptance(taskDir, criteria) {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    throw new Error('initAcceptance(): criteria must be a non-empty array')
  }
  const file = acceptanceFile(taskDir)
  try {
    await readFile(file, 'utf8')
    throw new Error('initAcceptance(): acceptance.json already exists — do not overwrite')
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  const items = criteria.map(normalize)
  const ids = new Set()
  for (const it of items) {
    if (ids.has(it.id)) throw new Error(`initAcceptance(): duplicate id "${it.id}"`)
    ids.add(it.id)
  }
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(items, null, 2) + '\n', 'utf8')
  return items
}

/** Read the checklist (empty array if not yet created). */
export async function loadAcceptance(taskDir) {
  const file = acceptanceFile(taskDir)
  let raw
  try {
    raw = await readFile(file, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return []
    throw e
  }
  return JSON.parse(raw)
}

/**
 * Flip one criterion to passes:true. Only false→true is allowed (idempotent).
 * @returns {Promise<{flipped: boolean, item: object}>}
 */
export async function flipToPassing(taskDir, id, meta = {}) {
  const list = await loadAcceptance(taskDir)
  const idx = list.findIndex((it) => it.id === id)
  if (idx === -1) throw new Error(`flipToPassing(): unknown criterion "${id}"`)
  if (list[idx].passes === true) return { flipped: false, item: list[idx] }
  const updated = list.map((it, i) =>
    i === idx
      ? { ...it, passes: true, verified_at: meta.verified_at ?? new Date().toISOString(), verified_by: meta.verified_by ?? null }
      : it
  )
  await writeFile(acceptanceFile(taskDir), JSON.stringify(updated, null, 2) + '\n', 'utf8')
  return { flipped: true, item: updated[idx] }
}

/** Criteria not yet passing. */
export async function pending(taskDir) {
  return (await loadAcceptance(taskDir)).filter((it) => it.passes !== true)
}

/** Criteria already passing. */
export async function done(taskDir) {
  return (await loadAcceptance(taskDir)).filter((it) => it.passes === true)
}

/** True only when there is at least one criterion and all are passing. */
export async function isComplete(taskDir) {
  const list = await loadAcceptance(taskDir)
  return list.length > 0 && list.every((it) => it.passes === true)
}

/** Progress summary. */
export async function progress(taskDir) {
  const list = await loadAcceptance(taskDir)
  const total = list.length
  const passed = list.filter((it) => it.passes === true).length
  return { total, passed, pending: total - passed, complete: total > 0 && passed === total }
}
