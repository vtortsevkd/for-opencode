// rule.js — rule-based graders: pure, deterministic, no I/O beyond the artifact.
// A rule grader validates the artifact object against a declared schema:
//   artifact.schema = { required: string[], type: { field: 'string'|'number'|'boolean'|'array'|'object' } }
function validateSchema(artifact, schema) {
  const problems = []
  for (const f of schema.required || []) {
    if (artifact == null || artifact[f] == null || artifact[f] === '') problems.push(`missing required field "${f}"`)
  }
  for (const [f, t] of Object.entries(schema.type || {})) {
    const v = artifact?.[f]
    if (v == null) continue
    const actual = Array.isArray(v) ? 'array' : typeof v
    if (actual !== t) problems.push(`field "${f}" expected ${t}, got ${actual}`)
  }
  return problems
}

export const ruleGraders = {
  async schema_valid({ artifact }) {
    const schema = artifact?.schema
    if (!schema) return { result: 'review', detail: 'no schema declared on artifact' }
    const problems = validateSchema(artifact, schema)
    if (problems.length === 0) return { result: 'pass', detail: 'artifact valid against schema' }
    return { result: 'fail', detail: problems.join('; ') }
  },

  // Regex constraint on a field value (e.g. forbids certain identifiers).
  async field_matches({ artifact, ctx }) {
    const { field, pattern, flags } = ctx?.rule || {}
    if (!field || !pattern) return { result: 'review', detail: 'rule config requires { field, pattern }' }
    const value = artifact?.[field]
    if (value == null) return { result: 'review', detail: `field "${field}" absent` }
    const re = new RegExp(pattern, flags)
    return re.test(String(value))
      ? { result: 'pass', detail: `field "${field}" matches pattern` }
      : { result: 'fail', detail: `field "${field}" does not match pattern` }
  },
}
