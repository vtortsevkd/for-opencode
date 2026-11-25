// registry.js — maps artifact type → ordered list of graders, and routes grade().
// Priority is code → rule → llm; an LLM grader runs only when it is explicitly
// listed for the artifact type (i.e. never as a fallback for a missing grader).
import { codeGraders } from './code.js'
import { ruleGraders } from './rule.js'
import { llmGraders } from './llm.js'

// Keys are artifact types used by the pipeline. Extend with your own.
export const registry = {
  created_object: ['code:verify_read_back', 'rule:schema_valid'],
  search_result: ['code:expected_row_count'],
  open_text_plan: ['llm:plan_quality'],
}

const pools = { code: codeGraders, rule: ruleGraders, llm: llmGraders }

/**
 * Grade an artifact against all graders registered for its type.
 * @param {string} artifactType
 * @param {object} artifact
 * @param {object} [ctx] — { tools, llmJudge, rule } passed through to graders.
 * @returns {Promise<{verdict: 'pass'|'fail'|'review', checks: object[]}>}
 */
export async function grade(artifactType, artifact, ctx = {}) {
  const specs = registry[artifactType]
  if (!specs) throw new Error(`grade(): unknown artifact type "${artifactType}"`)
  const checks = []
  for (const spec of specs) {
    const [kind, name] = spec.split(':')
    const grader = pools[kind]?.[name]
    if (!grader) throw new Error(`grade(): unknown grader "${spec}"`)
    const check = await grader({ artifact, ctx })
    checks.push({ name, type: kind, ...check })
  }

  let verdict = 'pass'
  if (checks.some((c) => c.result === 'fail')) verdict = 'fail'
  else if (checks.some((c) => c.result === 'review')) verdict = 'review'
  return { verdict, checks }
}
