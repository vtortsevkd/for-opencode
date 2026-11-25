// handoff.js — transfer bounded work state to the next stage/harness.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

export function handoffFile(taskDir) {
  return path.join(taskDir, 'handoff.json')
}

/**
 * Write a bounded handoff: summary + next steps + artifact references + decisions.
 * Keeps the next stage from re-deriving what happened.
 */
export async function writeHandoff(taskDir, { to = 'next', summary, next_steps = [], artifacts = [], decisions = [] }) {
  const file = handoffFile(taskDir)
  const data = {
    to,
    written_at: new Date().toISOString(),
    summary: summary ?? '',
    next_steps: Array.isArray(next_steps) ? next_steps : [],
    artifacts: Array.isArray(artifacts) ? artifacts : [],
    decisions: Array.isArray(decisions) ? decisions : [],
  }
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
  return data
}

/** Read the handoff (null if not present). */
export async function readHandoff(taskDir) {
  const file = handoffFile(taskDir)
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return null
    throw e
  }
}
