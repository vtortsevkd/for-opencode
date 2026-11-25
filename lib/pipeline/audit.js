// audit.js — the 12-layer agent-stack diagnostic checklist.
// Use this to find where an existing pipeline silently corrupts answers
// (hidden repair loops, memory contamination, tool discipline, rendering).
export const LAYERS = [
  { id: 1, name: 'System prompt', risk: 'Conflicting instructions, instruction bloat' },
  { id: 2, name: 'Session history', risk: 'Stale context injection from previous turns' },
  { id: 3, name: 'Long-term memory', risk: 'Pollution across sessions, old topics in new conversations' },
  { id: 4, name: 'Distillation', risk: 'Compressed artifacts re-entering as pseudo-facts' },
  { id: 5, name: 'Active recall', risk: 'Redundant re-summary layers wasting context' },
  { id: 6, name: 'Tool selection', risk: 'Wrong tool routing, model skips required tools' },
  { id: 7, name: 'Tool execution', risk: 'Hallucinated execution — claims to call but does not' },
  { id: 8, name: 'Tool interpretation', risk: 'Misread or ignored tool output' },
  { id: 9, name: 'Answer shaping', risk: 'Format corruption in final response' },
  { id: 10, name: 'Platform rendering', risk: 'Transport-layer mutation (UI/API/CLI mutates valid answers)' },
  { id: 11, name: 'Hidden repair loops', risk: 'Silent fallback/retry agents running a second LLM pass' },
  { id: 12, name: 'Persistence', risk: 'Expired state or cached artifacts reused as live evidence' },
]

export const DIAGNOSTIC_QUESTIONS = [
  { id: 1, question: 'Can the model skip a required tool and still answer?', ifYes: 'Tool not code-gated' },
  { id: 2, question: 'Does old conversation content appear in new turns?', ifYes: 'Memory contamination' },
  { id: 3, question: 'Is the same info in system prompt AND memory AND history?', ifYes: 'Context duplication' },
  { id: 4, question: 'Does the platform run a second LLM pass before delivery?', ifYes: 'Hidden repair loop' },
  { id: 5, question: 'Does output differ between internal generation and user delivery?', ifYes: 'Rendering corruption' },
  { id: 6, question: 'Are "must use tool X" rules only in prompt text?', ifYes: 'Tool discipline failure' },
  { id: 7, question: 'Can the agent\u2019s own monologue become persistent memory?', ifYes: 'Memory poisoning' },
]

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

export function auditChecklist() {
  return { layers: LAYERS, questions: DIAGNOSTIC_QUESTIONS }
}

/**
 * Render severity-ranked findings (critical first).
 * @param {Array<{severity, title, mechanism?, source_layer?, root_cause?}>} findings
 * @returns {string} markdown list
 */
export function renderFindings(findings = []) {
  const sorted = [...findings].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
  const lines = []
  for (const f of sorted) {
    const layer = f.source_layer ? ` (layer ${f.source_layer})` : ''
    const cause = f.root_cause ? ` — ${f.root_cause}` : ''
    lines.push(`- [${f.severity}] ${f.title}${layer}${cause}`)
  }
  return lines.join('\n')
}
