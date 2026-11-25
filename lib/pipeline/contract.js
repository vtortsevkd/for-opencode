// contract.js — negotiated sprint contract. Before work starts, the generator
// proposes what "done" means and how it is verified; the evaluator reviews and
// approves or rejects; iterate until agreement. Prevents "declaring victory early".
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

export function contractFile(taskDir) {
  return path.join(taskDir, 'contract.json')
}

export async function readContract(taskDir) {
  const file = contractFile(taskDir)
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return null
    throw e
  }
}

/** Propose (or revise) a contract. Increments rounds when revising. */
export async function proposeContract(taskDir, { id, goal, verification, scope }) {
  if (!id) throw new Error('proposeContract(): id required')
  const existing = await readContract(taskDir)
  const contract = {
    id,
    goal: goal ?? '',
    verification: Array.isArray(verification) ? verification : [],
    scope: scope ?? null,
    status: 'proposed',
    rounds: existing ? (existing.rounds ?? 1) + 1 : 1,
    proposed_at: new Date().toISOString(),
    approved_at: null,
    approved_by: null,
    rejected_reason: null,
  }
  await mkdir(path.dirname(contractFile(taskDir)), { recursive: true })
  await writeFile(contractFile(taskDir), JSON.stringify(contract, null, 2) + '\n', 'utf8')
  return contract
}

export async function approveContract(taskDir, by) {
  const c = await readContract(taskDir)
  if (!c) throw new Error('approveContract(): no contract proposed')
  const updated = { ...c, status: 'approved', approved_at: new Date().toISOString(), approved_by: by ?? null }
  await writeFile(contractFile(taskDir), JSON.stringify(updated, null, 2) + '\n', 'utf8')
  return updated
}

export async function rejectContract(taskDir, reason) {
  const c = await readContract(taskDir)
  if (!c) throw new Error('rejectContract(): no contract proposed')
  const updated = { ...c, status: 'rejected', rejected_reason: reason ?? null }
  await writeFile(contractFile(taskDir), JSON.stringify(updated, null, 2) + '\n', 'utf8')
  return updated
}

export async function isContractApproved(taskDir) {
  const c = await readContract(taskDir)
  return !!c && c.status === 'approved'
}

/**
 * Negotiate a contract: propose → review → approve/reject → revise, up to maxRounds.
 * @param {object} opts — { propose: async (rejectReason?) => contractContent, review: async (contract) => ({approved, reason?, by?}), maxRounds? }
 */
export async function negotiateContract(taskDir, { propose, review, maxRounds = 3 }) {
  if (typeof propose !== 'function' || typeof review !== 'function') {
    throw new Error('negotiateContract(): propose and review are required functions')
  }
  let content = await propose()
  for (let round = 1; round <= maxRounds; round++) {
    await proposeContract(taskDir, content)
    const verdict = await review(await readContract(taskDir))
    if (verdict?.approved) {
      await approveContract(taskDir, verdict.by)
      return { approved: true, rounds: round, contract: await readContract(taskDir) }
    }
    await rejectContract(taskDir, verdict?.reason)
    if (round < maxRounds) content = await propose(verdict?.reason)
  }
  return { approved: false, rounds: maxRounds, contract: await readContract(taskDir) }
}
