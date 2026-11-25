// santa.js — adversarial dual-review (santa-loop). Two independent reviewers
// with the same rubric must both approve; otherwise fix-and-re-review up to a cap.
export async function dualReview({ artifact, reviewA, reviewB, fix, maxRounds = 3 }) {
  if (typeof reviewA !== 'function' || typeof reviewB !== 'function') {
    throw new Error('dualReview(): reviewA and reviewB are required functions')
  }
  let current = artifact
  const history = []
  for (let round = 1; round <= maxRounds; round++) {
    const [a, b] = await Promise.all([reviewA(current), reviewB(current)])
    const approved = a?.verdict === 'pass' && b?.verdict === 'pass'
    history.push({ round, a, b, approved })
    if (approved) return { verdict: 'pass', rounds: round, history }
    if (round === maxRounds || typeof fix !== 'function') break
    const feedback = [a, b]
      .filter((r) => r?.verdict !== 'pass')
      .map((r) => r?.reason)
      .filter(Boolean)
      .join('; ')
    current = await fix(current, feedback)
  }
  return { verdict: 'escalate', rounds: maxRounds, history }
}
