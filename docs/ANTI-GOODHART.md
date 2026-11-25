# Anti-Goodhart: judge verdicts must have ground truth

## Problem

The "attacks + judges" loop can overfit: the agent learns to satisfy the judge's rubric rather than the real goal. An artifact can pass the judge while still not working end-to-end. This is Goodhart's law applied to your verifier.

## Rule

Every judge verdict must include at least one ground-truth check — a deterministic code or rule grader (verify read-back, expected row count, schema validity) — not only an LLM rubric.

## Helper

`goodhartRisk(checks)` in `lib/pipeline/judges/registry.js` returns:
- `high` — no checks, no ground-truth check, or all ground-truth checks failed;
- `low` — at least one passing code/rule check.

## The check (run periodically)

For a sample of completed tasks, ask: "does this artifact pass the judge but fail end-to-end?" If yes, the rubric is being gamed — add a ground-truth check the agent cannot see in advance.

## Mitigations

1. Require ≥1 code/rule grader per artifact type (already enforced by `judges/registry.js`).
2. Judge against ground truth, not against the rubric the agent optimized for.
3. Rotate/refresh judge rubrics so the agent cannot memorize them.
4. Prefer deterministic graders over LLM judges wherever a criterion is checkable.
