# Evaluator calibration & skepticism

## Problem

Agents reliably praise their own work when asked to self-evaluate — even when quality is obviously mediocre. This is the core unsolved problem in generator+evaluator systems.

## Insights (Anthropic, 2026)

1. **Separate the generator from the evaluator** — the strongest lever. But separation alone isn't enough: the evaluator is still an LLM inclined to be generous toward LLM output.
2. **Tune the evaluator to be skeptical** — far more tractable than making the generator self-critical.
3. **Calibrate with few-shot examples** + detailed score breakdowns — reduces score drift across iterations.
4. **Hard thresholds per criterion** — if any criterion falls below its threshold, the sprint fails.
5. **Weight criteria** — important dimensions (design, originality) outrank routine competence (craft, functionality).
6. **The evaluator is not a fixed yes/no** — it is worth its cost only when the task sits beyond what the model does reliably solo.

## How to apply to the FIS pipeline

- Keep judges as a separate agent (already done). Add to the judge prompt: "a pass is earned, not default — be skeptical".
- Calibrate judges with 2-3 canonical pass/fail examples per domain before grading.
- Every acceptance criterion has a hard threshold; `deliveryGate` already enforces all-pass.
- Pair `goodhartRisk` (flags verdicts without ground truth) with skeptical LLM judges for open artifacts.
- Weighted criteria: encode importance in the rubric, not as a flat checklist.

## Related

- `docs/ANTI-GOODHART.md`
- `lib/pipeline/judges/` (code/rule/llm/santa)
- `lib/pipeline/contract.js` (negotiated "done" before work)
