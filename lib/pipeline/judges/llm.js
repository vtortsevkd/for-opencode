// llm.js — LLM judges. The last resort, used only when no deterministic grader exists.
// The model call is host-specific: the pipeline wires ctx.llmJudge(artifact, prompt).
// When not wired, returns 'review' (never fabricates a pass/fail).
export const llmGraders = {
  async plan_quality({ artifact, ctx }) {
    const judge = ctx?.llmJudge
    if (typeof judge !== 'function') return { result: 'review', detail: 'llmJudge not wired' }
    try {
      const out = await judge(artifact, 'Is this plan clear, scoped and testable? Respond {result: "pass"|"fail"|"review", detail}')
      return { result: out?.result ?? 'review', detail: out?.detail ?? 'llm judge returned no verdict' }
    } catch (e) {
      return { result: 'review', detail: `llm judge error: ${e.message}` }
    }
  },
}
