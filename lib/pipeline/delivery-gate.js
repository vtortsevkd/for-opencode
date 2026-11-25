// delivery-gate.js — mechanical "done" gate. Blocks completion until the whole
// loop is closed: acceptance complete, ledger intact, tests green, reflection run.
import { isComplete } from './acceptance.js'
import { verifyChain, decisionsFor } from './ledger.js'

/**
 * @param {string} taskDir
 * @param {object} [opts] — { testsPassed?: boolean }
 * @returns {Promise<{ready: boolean, blockers: string[], checks: object}>}
 */
export async function deliveryGate(taskDir, { testsPassed = false } = {}) {
  const complete = await isComplete(taskDir)
  const chain = await verifyChain(taskDir)
  const decisions = await decisionsFor(taskDir)
  const reflectionDone = decisions.some((d) => d.type === 'reflection')

  const blockers = []
  if (!complete) blockers.push('acceptance: checklist not complete')
  if (!chain.valid) blockers.push('ledger: decision chain broken')
  if (!testsPassed) blockers.push('tests: not green')
  if (!reflectionDone) blockers.push('memory: reflection not run')

  return {
    ready: blockers.length === 0,
    blockers,
    checks: {
      acceptanceComplete: complete,
      chainValid: chain.valid,
      testsPassed,
      reflectionDone,
    },
  }
}
