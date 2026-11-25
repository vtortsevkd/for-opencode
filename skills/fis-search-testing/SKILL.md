---
name: fis-search-testing
description: Running and verifying FIS search functions locally — expected result, row count, and comparison. Activate when a search function must be executed or its behavior verified.
metadata:
  origin: FIS
---

# FIS Search Function Testing

Search functions are run against a local checkout, then verified against an expected result. The verification is deterministic (a code grader), not a vibe check.

## Workflow

1. **Identify the function** — name, inputs, and the expected output shape.
2. **Define the expectation before running**:
   - expected row count, OR
   - expected set of ids, OR
   - expected empty result for a negative case.
3. **Run on the local checkout** and capture the raw output.
4. **Compare deterministically**:
   - `expected_row_count` — returned row count must equal the expectation.
   - `expected_ids` — returned ids must match the expected set.
5. **Record the result** — pass/fail + the actual output as evidence.

## Test Cases to Cover

- Happy path (known positive query).
- Empty / no-match query (must return empty, not throw).
- Boundary inputs (empty string, very long string, special characters).

## Anti-Patterns

- Judging a function by "looks right" without comparing to a concrete expectation.
- Running a function and not recording its output as evidence.
- Ignoring the empty-result case (a common source of silent bugs).

## Deterministic Grader

The `code:expected_row_count` and `code:expected_ids` graders in `lib/pipeline/judges/code.js` implement this verification. Wire `ctx.tools.runSearch` to the local search runner.
