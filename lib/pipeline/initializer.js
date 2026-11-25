// initializer.js — first stage: scaffold the task environment so later stages
// start from a clean, well-understood state.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { initAcceptance } from './acceptance.js'
import { ledgerFile } from './ledger.js'

export function progressFile(taskDir) {
  return path.join(taskDir, 'progress.json')
}

/** Create the initial progress file (metadata + empty note log). */
export async function seedProgress(taskDir, meta = {}) {
  const file = progressFile(taskDir)
  const data = {
    task_id: meta.taskId ?? null,
    task_family: meta.taskFamily ?? null,
    created_at: new Date().toISOString(),
    status: 'in_progress',
    notes: [],
  }
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
  return data
}

/**
 * Scaffold a task: acceptance checklist (fails closed if it already exists),
 * empty decision journal, and a progress file.
 * @param {string} taskDir
 * @param {object} opts — { taskId, taskFamily?, criteria: Array<{id, description}> }
 */
export async function initTask(taskDir, { taskId, taskFamily, criteria }) {
  if (!taskId) throw new Error('initTask(): taskId required')
  if (!Array.isArray(criteria) || criteria.length === 0) throw new Error('initTask(): criteria must be a non-empty array')

  const acceptance = await initAcceptance(taskDir, criteria) // throws if already initialized
  const progress = await seedProgress(taskDir, { taskId, taskFamily })
  await mkdir(path.dirname(ledgerFile(taskDir)), { recursive: true })
  await writeFile(ledgerFile(taskDir), '', 'utf8')

  return {
    taskDir,
    acceptance,
    progress,
    ledgerFile: ledgerFile(taskDir),
    next: ['read progress.json + acceptance.json', 'run smoke test', 'pick the first pending criterion'],
  }
}

/** Append a note to the progress file. */
export async function appendProgressNote(taskDir, note) {
  const file = progressFile(taskDir)
  const raw = await readFile(file, 'utf8')
  const data = JSON.parse(raw)
  data.notes = [...(data.notes || []), { ts: new Date().toISOString(), note }]
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
  return data
}
